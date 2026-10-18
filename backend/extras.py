"""Password reset, per-user channel connections, approved sending + scheduling, and Stripe billing routes."""
import base64, hashlib, json, logging, os, threading, time
from datetime import datetime, timedelta, timezone
from flask import g, jsonify, request
from cryptography.fernet import Fernet, InvalidToken
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import generate_password_hash
import auth, billing, channels, db, mailer

_started = False


def _fernet():
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(os.environ.get("SECRET_KEY", "dev-only-change-me").encode()).digest()))


def _reset_ser():
    return URLSafeTimedSerializer(os.environ.get("SECRET_KEY", "dev-only-change-me"), salt="password-reset")


def _fp(pw_hash):
    return hashlib.sha256(pw_hash.encode()).hexdigest()[:16]


def get_config(uid, kind):
    with db.conn() as c:
        row = c.x("SELECT config FROM integrations WHERE user_id=? AND kind=?", (uid, kind)).one()
    if not row:
        return None
    try:
        return json.loads(_fernet().decrypt(row["config"].encode()))
    except (InvalidToken, ValueError):
        return None


def plan_limits(user):
    return billing.effective(user)


def deliver(row):
    """Send one outbox row now and record the outcome. Never raises."""
    cfg = get_config(row["user_id"], row["channel"])
    try:
        if not cfg:
            raise channels.ChannelError("This channel is not connected any more.")
        result = channels.send(row["channel"], cfg, row["body"], row.get("target", ""))
        status = "sent"
    except channels.ChannelError as e:
        result, status = str(e), "failed"
    with db.conn() as c:
        c.x("UPDATE outbox SET status=?, result=?, sent_at=? WHERE id=?", (status, result[:300], db.now(), row["id"]))
    if status == "sent":
        db.log(row["user_id"], "send", f"Sent to {channels.FIELDS[row['channel']]['label']}")
        if row.get("content_id"):
            with db.conn() as c:
                c.x("UPDATE contents SET status='posted' WHERE id=? AND user_id=?", (row["content_id"], row["user_id"]))
    return status, result


def run_due():
    """Send scheduled posts whose time has come. Each row is claimed first so it can never go out twice."""
    with db.conn() as c:
        due = c.x("SELECT * FROM outbox WHERE status='scheduled' AND send_at<=? ORDER BY send_at LIMIT 20", (db.now(),)).all()
    sent = 0
    for row in due:
        with db.conn() as c:
            if c.x("UPDATE outbox SET status='sending' WHERE id=? AND status='scheduled'", (row["id"],)).count != 1:
                continue
        deliver(row)
        sent += 1
    return sent


def start_scheduler():
    global _started
    if _started:
        return
    _started = True

    def loop():
        while True:
            time.sleep(60)
            try:
                run_due()
            except Exception:
                pass
    threading.Thread(target=loop, daemon=True).start()


def _base():
    return (os.environ.get("APP_URL") or request.url_root).rstrip("/") + "/"


def register(app):
    body = lambda: request.get_json(silent=True) or {}

    # ---------- password reset ----------
    @app.post("/api/auth/forgot")
    def forgot():
        email = (body().get("email") or "").strip().lower()
        with db.conn() as c:
            u = c.x("SELECT * FROM users WHERE email=? AND is_demo=0", (email,)).one()
        if u:
            token = _reset_ser().dumps({"uid": u["id"], "fp": _fp(u["password_hash"])})
            link = f"{_base()}#/reset/{token}"
            if not mailer.configured():
                # No email service: the owner can read the link in the server logs and pass it on.
                logging.getLogger("bizcuits").warning("Password reset link for %s (valid 1 hour): %s", email, link)
                return jsonify(ok=True, message="Email is not set up on this server, so the site owner can send you the reset link. If that email has an account, they will find it in the server logs.")
            try:
                mailer.send(email, "Reset your Bizcuits password", f"Hi!\n\nUse this link within one hour to choose a new password:\n{link}\n\nIf you did not ask for this, you can ignore this email.")
            except mailer.MailUnavailable as e:
                return jsonify(error=str(e)), 503
        return jsonify(ok=True, message="If that email has an account, a reset link is on its way.")

    @app.post("/api/auth/reset")
    def reset():
        b = body()
        if len(b.get("password") or "") < 8:
            raise db.ValidationError("Password must be at least 8 characters.")
        try:
            data = _reset_ser().loads(b.get("token", ""), max_age=3600)
        except (BadSignature, SignatureExpired):
            raise db.ValidationError("This reset link is invalid or has expired. Ask for a new one.")
        with db.conn() as c:
            u = c.x("SELECT * FROM users WHERE id=?", (data["uid"],)).one()
            if not u or _fp(u["password_hash"]) != data["fp"]:
                raise db.ValidationError("This reset link was already used. Ask for a new one.")
            c.x("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(b["password"]), u["id"]))
        return jsonify(ok=True)

    # ---------- connections ----------
    def mask(v):
        return "••••" + v[-4:] if len(v) > 4 else "••••"

    @app.get("/api/integrations")
    @auth.require_user
    def integrations():
        out = []
        for kind, meta in channels.FIELDS.items():
            cfg = get_config(g.uid, kind)
            out.append({"kind": kind, "label": meta["label"], "fields": [{"key": k, "label": l} for k, l in meta["fields"]],
                        "connected": bool(cfg), "saved": {k: mask(cfg[k]) for k, _ in meta["fields"] if cfg and cfg.get(k)} if cfg else {}})
        return jsonify(out)

    @app.put("/api/integrations/<kind>")
    @auth.require_user
    def save_integration(kind):
        if kind not in channels.FIELDS:
            return jsonify(error="Unknown channel."), 404
        old = get_config(g.uid, kind) or {}
        b = body().get("config") or {}
        cfg = {}
        for k, label in channels.FIELDS[kind]["fields"]:
            v = (b.get(k) or "").strip() or old.get(k, "")
            if not v:
                raise db.ValidationError(f"{label} is required.")
            cfg[k] = v
        token = _fernet().encrypt(json.dumps(cfg).encode()).decode()
        with db.conn() as c:
            c.x("DELETE FROM integrations WHERE user_id=? AND kind=?", (g.uid, kind))
            c.insert("integrations", {"user_id": g.uid, "kind": kind, "config": token, "created_at": db.now()})
        return jsonify(ok=True)

    @app.delete("/api/integrations/<kind>")
    @auth.require_user
    def drop_integration(kind):
        with db.conn() as c:
            c.x("DELETE FROM integrations WHERE user_id=? AND kind=?", (g.uid, kind))
        return jsonify(ok=True)

    @app.post("/api/integrations/<kind>/verify")
    @auth.require_user
    def verify_integration(kind):
        cfg = get_config(g.uid, kind)
        if not cfg:
            raise db.ValidationError("Save your details first.")
        try:
            return jsonify(ok=True, detail=channels.verify(kind, cfg))
        except channels.ChannelError as e:
            return jsonify(error=str(e)), 400

    # ---------- sending (always an explicit, confirmed user action) ----------
    @app.post("/api/send")
    @auth.require_user
    def send_now():
        b = body()
        channel, text = b.get("channel"), (b.get("body") or "").strip()
        if channel not in channels.FIELDS:
            raise db.ValidationError("Choose a channel.")
        if not text or len(text) > 4000:
            raise db.ValidationError("Write a message of up to 4000 characters.")
        if b.get("confirm") is not True:
            raise db.ValidationError("Please confirm before sending.")
        if not get_config(g.uid, channel):
            raise db.ValidationError("Connect this channel first.")
        row = {"user_id": g.uid, "channel": channel, "target": (b.get("to") or "").strip()[:30], "body": text, "content_id": b.get("content_id") or None, "created_at": db.now()}
        if b.get("send_at"):
            if channel == "whatsapp":
                raise db.ValidationError("WhatsApp messages go out right away, after you confirm. Scheduling is for posts.")
            try:
                when = datetime.fromisoformat(str(b["send_at"]).replace("Z", "+00:00")).astimezone(timezone.utc)
            except ValueError:
                raise db.ValidationError("That date and time is not valid.")
            now = datetime.now(timezone.utc)
            if when < now - timedelta(minutes=1) or when > now + timedelta(days=90):
                raise db.ValidationError("Pick a time within the next 90 days.")
            with db.conn() as c:
                waiting = c.x("SELECT id FROM outbox WHERE user_id=? AND status='scheduled'", (g.uid,)).all()
            if len(waiting) >= plan_limits(g.user)["scheduled"]:
                raise db.ValidationError("You have reached your plan's limit of scheduled posts.")
            row.update(send_at=when.strftime("%Y-%m-%d %H:%M:%S"), status="scheduled")
            with db.conn() as c:
                rid = c.insert("outbox", row)
            if row["content_id"]:
                db.update("contents", g.uid, row["content_id"], {"status": "scheduled"})
            return jsonify(db.get("outbox", g.uid, rid)), 201
        row.update(send_at=db.now(), status="sending")
        with db.conn() as c:
            rid = c.insert("outbox", row)
        deliver({**row, "id": rid})
        out = db.get("outbox", g.uid, rid)
        return jsonify(out), (201 if out["status"] == "sent" else 502)

    @app.get("/api/outbox")
    @auth.require_user
    def outbox():
        return jsonify(db.list_rows("outbox", g.uid, "id DESC")[:50])

    @app.delete("/api/outbox/<int:id_>")
    @auth.require_user
    def cancel(id_):
        row = db.get("outbox", g.uid, id_)
        if not row or row["status"] == "sending":
            return jsonify(error="Not found."), 404
        if row["status"] == "scheduled" and row.get("content_id"):
            db.update("contents", g.uid, row["content_id"], {"status": "draft"})
        db.delete("outbox", g.uid, id_)
        return jsonify(ok=True)

    @app.route("/api/cron/run", methods=["GET", "POST"])
    def cron():
        key = os.environ.get("CRON_SECRET", "")
        if not key or request.args.get("key") != key:
            return jsonify(error="Not found."), 404
        return jsonify(sent=run_due())

    # ---------- billing ----------
    @app.get("/api/billing/status")
    @auth.require_user
    def billing_status():
        lim = plan_limits(g.user)
        with db.conn() as c:
            n = {t: len(c.x(f"SELECT id FROM {t} WHERE user_id=?", (g.uid,)).all()) for t in ("products", "menu_items")}
        return jsonify(plan=g.user.get("plan") or "free", limits=lim, usage=n, configured=billing.configured(), metered=billing.configured(), manage=bool(g.user.get("stripe_customer")))

    @app.post("/api/billing/checkout")
    @auth.require_user
    def checkout():
        if g.user.get("is_demo"):
            raise db.ValidationError("Create a real account to upgrade.")
        try:
            return jsonify(url=billing.checkout_url(g.user, _base()))
        except billing.BillingError as e:
            return jsonify(error=str(e)), 503

    @app.post("/api/billing/portal")
    @auth.require_user
    def portal():
        try:
            return jsonify(url=billing.portal_url(g.user, _base()))
        except billing.BillingError as e:
            return jsonify(error=str(e)), 503

    @app.post("/api/billing/webhook")
    def webhook():
        try:
            ev = billing.verify_webhook(request.get_data(), request.headers.get("Stripe-Signature", ""))
        except billing.BillingError:
            return jsonify(error="Bad request."), 400
        obj = ev.get("data", {}).get("object", {})
        with db.conn() as c:
            if ev.get("type") == "checkout.session.completed" and str(obj.get("client_reference_id", "")).isdigit():
                c.x("UPDATE users SET plan='pro', stripe_customer=? WHERE id=?", (obj.get("customer") or "", int(obj["client_reference_id"])))
            elif ev.get("type") in ("customer.subscription.updated", "customer.subscription.deleted") and obj.get("customer"):
                active = ev["type"] == "customer.subscription.updated" and obj.get("status") in ("active", "trialing")
                c.x("UPDATE users SET plan=? WHERE stripe_customer=?", ("pro" if active else "free", obj["customer"]))
        return jsonify(received=True)
