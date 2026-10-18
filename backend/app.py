"""Bizcuits API (Flask). Also serves the built React app so one free Render service can host everything."""
import os, time, secrets
from collections import defaultdict, deque
from flask import Flask, g, jsonify, request, send_from_directory
import db, ai, analytics, auth, seed, extras, billing, fallback

DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
RESOURCES = {"products": "products", "menu": "menu_items", "content": "contents", "policies": "policies", "feedback": "feedback", "tasks": "tasks"}
TONES = {"friendly", "professional", "playful", "elegant", "concise", "warm", "apologetic"}
LABEL = {"products": "Added product", "contents": "Saved content", "feedback": "Added feedback", "tasks": "Added task", "menu_items": "Added menu item"}
_hits = defaultdict(deque)
AI_LIMIT, AI_WINDOW = int(os.environ.get("AI_LIMIT_PER_HOUR", 40)), 3600


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
    db.init()

    @app.errorhandler(db.ValidationError)
    def _val(e):
        return jsonify(error=str(e)), 400

    @app.errorhandler(ai.AIUnavailable)
    def _ai(e):
        return jsonify(error=str(e), ai_unavailable=True), 503

    @app.errorhandler(413)
    def _big(e):
        return jsonify(error="File is too large (2 MB max)."), 413

    @app.errorhandler(404)
    def _nf(e):
        return jsonify(error="Not found."), 404

    @app.errorhandler(500)
    def _500(e):
        return jsonify(error="Something went wrong on our side."), 500

    def body():
        return request.get_json(silent=True) or {}

    def limit_ai():
        q, t = _hits[g.uid], time.time()
        cap = min(AI_LIMIT, billing.effective(g.user)["ai_per_hour"]) if os.environ.get("AI_LIMIT_PER_HOUR") else billing.effective(g.user)["ai_per_hour"]
        while q and t - q[0] > AI_WINDOW:
            q.popleft()
        if len(q) >= cap:
            raise ai.AIUnavailable(f"You have reached your plan's limit of {cap} AI requests this hour. Try again later or upgrade in Settings.")
        q.append(t)

    # ---------- accounts ----------
    def session(uid):
        with db.conn() as c:
            u = c.x("SELECT * FROM users WHERE id=?", (uid,)).one()
        return jsonify(token=auth.token_for(uid), user=auth.public(u))

    @app.post("/api/auth/register")
    def register():
        b = body()
        return session(auth.register(b.get("email"), b.get("password"), b.get("name", ""), b.get("business", "")))

    @app.post("/api/auth/login")
    def login():
        b = body()
        return session(auth.login(b.get("email"), b.get("password")))

    @app.post("/api/auth/demo")
    def demo():
        uid = auth.register(f"sample-{secrets.token_hex(4)}@sample.bizcuits.local", secrets.token_urlsafe(12), "Sample", "Sample shop", demo=True)
        seed.seed(uid)
        return session(uid)

    @app.get("/api/auth/me")
    @auth.require_user
    def me():
        return jsonify(user=auth.public(g.user))

    @app.put("/api/auth/me")
    @auth.require_user
    def update_me():
        b = body()
        with db.conn() as c:
            c.x("UPDATE users SET name=?, business=? WHERE id=?", ((b.get("name") or "").strip(), (b.get("business") or "").strip(), g.uid))
        return me()

    @app.delete("/api/auth/account")
    @auth.require_user
    def delete_account():
        db.delete_user(g.uid)
        return jsonify(ok=True)

    @app.get("/api/export")
    @auth.require_user
    def export_all():
        data = {t: db.list_rows(t, g.uid) for t in db.USER_TABLES if t != "integrations"}
        data["account"] = auth.public(g.user)
        return jsonify(data)

    # ---------- generic CRUD ----------
    def register_crud(path, table):
        @auth.require_user
        def lst():
            order = "due_date='' , due_date ASC, id DESC" if table == "tasks" else "id DESC"
            return jsonify(db.list_rows(table, g.uid, order))

        @auth.require_user
        def add():
            cap = {"products": "products", "menu_items": "menu_items"}.get(table)
            if cap:
                have = len(db.list_rows(table, g.uid))
                if have >= billing.effective(g.user)[cap]:
                    return jsonify(error="You have reached your plan's limit. Upgrade in Settings to add more.", limit=True), 402
            row = db.create(table, g.uid, body())
            if table in LABEL:
                db.log(g.uid, table, f"{LABEL[table]} \"{row.get('name') or row.get('title') or row.get('kind') or row.get('body', '')[:40]}\"")
            return jsonify(row), 201

        @auth.require_user
        def edit(id_):
            row = db.update(table, g.uid, id_, body())
            if not row:
                return jsonify(error="Not found."), 404
            if table == "tasks" and row["status"] == "done" and "status" in body():
                db.log(g.uid, "tasks", f"Completed task \"{row['title']}\"")
            return jsonify(row)

        @auth.require_user
        def rm(id_):
            return (jsonify(ok=True), 200) if db.delete(table, g.uid, id_) else (jsonify(error="Not found."), 404)

        app.add_url_rule(f"/api/{path}", f"list_{path}", lst)
        app.add_url_rule(f"/api/{path}", f"add_{path}", add, methods=["POST"])
        app.add_url_rule(f"/api/{path}/<int:id_>", f"edit_{path}", edit, methods=["PUT"])
        app.add_url_rule(f"/api/{path}/<int:id_>", f"rm_{path}", rm, methods=["DELETE"])

    for p, t in RESOURCES.items():
        register_crud(p, t)

    # ---------- AI (with a free built-in fallback) ----------
    def produce(prompt, fb):
        """Gemma when connected; otherwise, or if it fails, a built-in template draft. Returns (text, source)."""
        if ai.configured():
            limit_ai()
            try:
                return ai.generate(prompt), "ai"
            except ai.AIUnavailable:
                pass
        try:
            return fb(), "template"
        except LookupError as e:
            raise ai.AIUnavailable(str(e))

    def tone(b, default="friendly"):
        t = (b.get("tone") or default).lower()
        if t not in TONES:
            raise db.ValidationError("Unknown tone.")
        return t

    def need(table, id_):
        try:
            row = db.get(table, g.uid, int(id_))
        except (TypeError, ValueError):
            row = None
        if not row:
            raise db.ValidationError("Pick a saved item first.")
        return row

    @app.post("/api/ai/product")
    @auth.require_user
    def ai_product():
        b = body()
        mode = b.get("mode", "description")
        if mode not in ("description", "title", "keywords", "promo"):
            raise db.ValidationError("Unknown mode.")
        p = need("products", b.get("product_id"))
        t = tone(b)
        text, src = produce(ai.product_prompt(p, mode, t, b.get("audience", "")), lambda: fallback.product(p, mode, t, b.get("audience", "")))
        return jsonify(text=text, source=src)

    @app.post("/api/ai/content")
    @auth.require_user
    def ai_content():
        b = body()
        if not b.get("kind"):
            raise db.ValidationError("Choose a content format.")
        p = need("products", b.get("product_id"))
        t = tone(b)
        text, src = produce(ai.content_prompt(p, b["kind"], t), lambda: fallback.content(p, b["kind"], t))
        return jsonify(text=text, source=src)

    @app.post("/api/ai/reply")
    @auth.require_user
    def ai_reply():
        b = body()
        if not (b.get("message") or "").strip():
            raise db.ValidationError("Paste the customer's message.")
        t, pols, msg = tone(b, "warm"), db.list_rows("policies", g.uid), b["message"][:3000]
        text, src = produce(ai.reply_prompt(msg, t, pols), lambda: fallback.reply(msg, t, pols))
        return jsonify(text=text, source=src, needs_info=text.upper().startswith("NEED_INFO"))

    @app.post("/api/ai/menu")
    @auth.require_user
    def ai_menu():
        b = body()
        if b.get("mode") not in ("translate", "simple", "delivery", "special"):
            raise db.ValidationError("Unknown mode.")
        item = need("menu_items", b.get("item_id"))
        lang = (b.get("language") or "Spanish")[:40]
        text, src = produce(ai.menu_prompt(item, b["mode"], lang), lambda: fallback.menu(item, b["mode"], lang))
        return jsonify(text=text, source=src)

    @app.post("/api/ai/plan")
    @auth.require_user
    def ai_plan():
        goal = (body().get("goal") or "").strip()[:300]
        if not goal:
            raise db.ValidationError("Describe your goal first.")
        raw, src = produce(ai.plan_prompt(goal), lambda: "\n".join(fallback.plan(goal)))
        lines = [l.strip(" -*\t") for l in raw.splitlines() if l.strip()]
        return jsonify(steps=lines[:8], source=src)

    @app.post("/api/ai/explain-sales")
    @auth.require_user
    def explain_sales():
        s = analytics.summarize(db.list_rows("sales", g.uid))
        if not s:
            raise db.ValidationError("Import sales first.")
        text, src = produce(ai.explain_prompt(s), lambda: fallback.sales(s))
        return jsonify(text=text, source=src)

    # ---------- feedback ----------
    @app.post("/api/feedback/bulk")
    @auth.require_user
    def fb_bulk():
        b = body()
        lines = [l.strip() for l in (b.get("text") or "").splitlines() if l.strip()][:500]
        if not lines:
            raise db.ValidationError("Paste at least one comment.")
        for l in lines:
            db.create("feedback", g.uid, {"body": l[:2000], "product_id": b.get("product_id")})
        db.log(g.uid, "feedback", f"Added {len(lines)} comments")
        return jsonify(added=len(lines)), 201

    @app.post("/api/feedback/import")
    @auth.require_user
    def fb_import():
        f = request.files.get("file")
        if not f or not f.filename.lower().endswith(".csv"):
            raise db.ValidationError("Upload a .csv file.")
        rows, errors = analytics.parse_feedback_csv(f.read())
        for r in rows:
            db.create("feedback", g.uid, r)
        if rows:
            db.log(g.uid, "feedback", f"Imported {len(rows)} comments")
        return jsonify(imported=len(rows), errors=errors), (200 if rows else 400)

    @app.get("/api/feedback/insights")
    @auth.require_user
    def fb_insights():
        return jsonify(analytics.feedback_insights(db.list_rows("feedback", g.uid)))

    @app.post("/api/feedback/summary")
    @auth.require_user
    def fb_summary():
        ins = analytics.feedback_insights(db.list_rows("feedback", g.uid))
        if not ins:
            raise db.ValidationError("Add feedback first.")
        slim = [{"theme": t["name"], "comments": t["count"]} for t in ins["themes"]]
        text, src = produce(ai.themes_prompt(slim, ins["total"]), lambda: fallback.themes(slim, ins["total"]))
        return jsonify(text=text, source=src)

    # ---------- sales ----------
    @app.post("/api/sales/upload")
    @auth.require_user
    def sales_upload():
        f = request.files.get("file")
        if not f or not f.filename.lower().endswith(".csv"):
            raise db.ValidationError("Upload a .csv file.")
        rows, errors = analytics.parse_csv(f.read())
        if rows:
            with db.conn() as c:
                for r in rows:
                    c.insert("sales", {"user_id": g.uid, **r})
            db.log(g.uid, "sales", f"Imported {len(rows)} sales rows")
        return jsonify(imported=len(rows), errors=errors), (200 if rows else 400)

    @app.get("/api/sales/summary")
    @auth.require_user
    def sales_summary():
        return jsonify(analytics.summarize(db.list_rows("sales", g.uid)))

    @app.delete("/api/sales")
    @auth.require_user
    def sales_clear():
        with db.conn() as c:
            c.x("DELETE FROM sales WHERE user_id=?", (g.uid,))
        return jsonify(ok=True)

    # ---------- dashboard + sharing ----------
    @app.get("/api/dashboard")
    @auth.require_user
    def dashboard():
        tasks = db.list_rows("tasks", g.uid, "due_date='', due_date ASC")
        open_ = [t for t in tasks if t["status"] == "open"]
        today = time.strftime("%Y-%m-%d")
        done = sorted((t for t in tasks if t["status"] == "done"), key=lambda t: t.get("done_at") or "", reverse=True)
        counts = {t: len(db.list_rows(t, g.uid)) for t in ("products", "contents", "feedback", "tasks")}
        ins = analytics.feedback_insights(db.list_rows("feedback", g.uid))
        tip = next((t for t in (ins or {}).get("themes", []) if t["name"] == "Description clarity"), None)
        return jsonify(counts=counts, tasks=open_[:4], overdue=len([t for t in open_ if t["due_date"] and t["due_date"] < today]), completed=done[:3],
                       activity=db.list_rows("activity", g.uid)[:5], sales=analytics.summarize(db.list_rows("sales", g.uid)), tip=tip)

    @app.post("/api/menu/share")
    @auth.require_user
    def menu_share():
        with db.conn() as c:
            c.x("UPDATE users SET menu_public=? WHERE id=?", (1 if body().get("enabled") else 0, g.uid))
        return me()

    @app.get("/api/public/menu/<slug>")
    def public_menu(slug):
        with db.conn() as c:
            u = c.x("SELECT id, business, name FROM users WHERE menu_slug=? AND menu_public=1", (slug,)).one()
        if not u or not slug:
            return jsonify(error="This menu is not available."), 404
        items = [{k: i[k] for k in ("name", "category", "price", "description", "ingredients", "allergens")} for i in db.list_rows("menu_items", u["id"], "category, name")]
        return jsonify(business=u["business"] or u["name"] or "Menu", items=items)

    extras.register(app)
    if os.environ.get("RENDER") or os.environ.get("BIZCUITS_SCHEDULER"):
        extras.start_scheduler()

    @app.get("/api/health")
    def health():
        return jsonify(ok=True, ai_configured=ai.configured(), database="postgres" if db.pg() else "sqlite", email=extras.mailer.configured(), billing=billing.configured())

    @app.get("/", defaults={"p": ""})
    @app.get("/<path:p>")
    def spa(p):
        if p.startswith("api/"):
            return jsonify(error="Not found."), 404
        full = os.path.join(DIST, p)
        if p and os.path.isfile(full):
            return send_from_directory(DIST, p)
        if os.path.exists(os.path.join(DIST, "index.html")):
            return send_from_directory(DIST, "index.html")
        return jsonify(message="Bizcuits API is running. Build the frontend or run it with Vite."), 200

    return app


def load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass


load_env()
app = create_app() if os.environ.get("RENDER") or os.environ.get("BIZCUITS_EAGER") else None

if __name__ == "__main__":
    create_app().run(port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("FLASK_DEBUG") == "1")
