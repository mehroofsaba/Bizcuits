"""Stripe subscriptions via the REST API (no SDK). Plan limits live here."""
import hashlib, hmac, json, os, time, urllib.error, urllib.parse, urllib.request

LIMITS = {
    "free": {"products": 15, "menu_items": 30, "ai_per_hour": 20, "scheduled": 10},
    "pro": {"products": 500, "menu_items": 1000, "ai_per_hour": 200, "scheduled": 500},
}
PRICE_LABEL = os.environ.get("PRO_PRICE_LABEL", "Pro")


class BillingError(Exception):
    pass


def limits(plan):
    return LIMITS.get(plan, LIMITS["free"])


def effective(user):
    """Self-hosted without Stripe: nobody can upgrade, so nothing is capped."""
    return limits(user.get("plan")) if configured() else LIMITS["pro"]


def configured():
    return bool(os.environ.get("STRIPE_SECRET_KEY") and os.environ.get("STRIPE_PRICE_ID"))


def _post(path, data):
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise BillingError("Billing is not set up on this server.")
    req = urllib.request.Request("https://api.stripe.com/v1" + path, urllib.parse.urlencode(data).encode(), {"Authorization": "Bearer " + key})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get("error", {}).get("message")
        except Exception:
            msg = None
        raise BillingError(msg or "Stripe refused the request.")
    except (urllib.error.URLError, TimeoutError):
        raise BillingError("Could not reach Stripe. Try again.")


def checkout_url(user, base):
    if not configured():
        raise BillingError("Billing is not set up on this server.")
    d = {"mode": "subscription", "line_items[0][price]": os.environ["STRIPE_PRICE_ID"], "line_items[0][quantity]": 1,
         "success_url": base + "#/app/settings?billing=success", "cancel_url": base + "#/app/settings", "client_reference_id": user["id"]}
    if user.get("stripe_customer"):
        d["customer"] = user["stripe_customer"]
    else:
        d["customer_email"] = user["email"]
    return _post("/checkout/sessions", d)["url"]


def portal_url(user, base):
    if not user.get("stripe_customer"):
        raise BillingError("No subscription found for this account.")
    return _post("/billing_portal/sessions", {"customer": user["stripe_customer"], "return_url": base + "#/app/settings"})["url"]


def verify_webhook(payload: bytes, header: str, tolerance=300):
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        raise BillingError("Webhook secret is not set.")
    parts = dict(p.split("=", 1) for p in (header or "").split(",") if "=" in p)
    t, sig = parts.get("t", ""), parts.get("v1", "")
    expected = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    if not t.isdigit() or abs(time.time() - int(t)) > tolerance or not hmac.compare_digest(expected, sig):
        raise BillingError("Bad signature.")
    return json.loads(payload)
