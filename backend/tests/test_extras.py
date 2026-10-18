import hashlib, hmac, json, os, sys, time
from datetime import datetime, timedelta, timezone
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import db, channels, extras, mailer, billing
from app import create_app
from test_api import C, signup


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    for k in ("GEMMA_BACKEND", "RESEND_API_KEY", "SMTP_HOST", "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"):
        monkeypatch.delenv(k, raising=False)
    return create_app().test_client()


def test_password_reset_without_email_logs_link(raw, caplog):
    signup(raw, "r@r.co")
    with caplog.at_level("WARNING", logger="bizcuits"):
        r = raw.post("/api/auth/forgot", json={"email": "r@r.co"})
    assert r.status_code == 200 and "owner" in r.get_json()["message"] and "#/reset/" in caplog.text
    token = caplog.text.split("#/reset/")[1].split()[0]
    assert raw.post("/api/auth/reset", json={"token": token, "password": "freshpass99"}).status_code == 200


def test_password_reset_flow(raw, monkeypatch):
    signup(raw, "r@r.co")
    sent = []
    monkeypatch.setenv("RESEND_API_KEY", "x")
    monkeypatch.setattr(mailer, "send", lambda to, sub, text: sent.append((to, text)))
    assert raw.post("/api/auth/forgot", json={"email": "nobody@r.co"}).status_code == 200 and not sent
    assert raw.post("/api/auth/forgot", json={"email": "r@r.co"}).status_code == 200
    token = sent[0][1].split("#/reset/")[1].split()[0]
    assert raw.post("/api/auth/reset", json={"token": token, "password": "short"}).status_code == 400
    assert raw.post("/api/auth/reset", json={"token": "junk", "password": "newpassword1"}).status_code == 400
    assert raw.post("/api/auth/reset", json={"token": token, "password": "newpassword1"}).status_code == 200
    assert raw.post("/api/auth/reset", json={"token": token, "password": "another-pass1"}).status_code == 400  # single use
    assert raw.post("/api/auth/login", json={"email": "r@r.co", "password": "newpassword1"}).status_code == 200
    assert raw.post("/api/auth/login", json={"email": "r@r.co", "password": "password1"}).status_code == 400


def test_connections_are_encrypted_masked_and_private(raw, monkeypatch):
    a, b = signup(raw, "a@a.co"), signup(raw, "b@b.co")
    assert a.put("/api/integrations/telegram", json={"config": {"bot_token": "123456:SECRETTOKEN"}}).status_code == 400
    assert a.put("/api/integrations/telegram", json={"config": {"bot_token": "123456:SECRETTOKEN", "chat_id": "@shop"}}).status_code == 200
    tg = [i for i in a.get("/api/integrations").get_json() if i["kind"] == "telegram"][0]
    assert tg["connected"] and tg["saved"]["bot_token"] == "••••OKEN" and "SECRET" not in json.dumps(tg)
    assert not [i for i in b.get("/api/integrations").get_json() if i["kind"] == "telegram"][0]["connected"]
    with db.conn() as c:
        assert "SECRETTOKEN" not in c.x("SELECT config FROM integrations").one()["config"]
    monkeypatch.setattr(channels, "verify", lambda k, cfg: "@shopbot")
    assert a.post("/api/integrations/telegram/verify").get_json()["detail"] == "@shopbot"
    assert "integrations" not in a.get("/api/export").get_json()


def test_send_needs_confirm_connection_and_records(raw, monkeypatch):
    a = signup(raw)
    monkeypatch.setattr(channels, "send", lambda kind, cfg, text, to="": f"ok {kind}")
    msg = {"channel": "telegram", "body": "Hello"}
    assert a.post("/api/send", json=msg).status_code == 400  # no confirm
    assert a.post("/api/send", json={**msg, "confirm": True}).status_code == 400  # not connected
    a.put("/api/integrations/telegram", json={"config": {"bot_token": "t", "chat_id": "c"}})
    c = a.post("/api/content", json={"kind": "Caption", "body": "Hello"}).get_json()
    r = a.post("/api/send", json={**msg, "confirm": True, "content_id": c["id"]})
    assert r.status_code == 201 and r.get_json()["status"] == "sent"
    assert a.get("/api/content").get_json()[0]["status"] == "posted"
    monkeypatch.setattr(channels, "send", lambda *a, **k: (_ for _ in ()).throw(channels.ChannelError("Token expired")))
    r = a.post("/api/send", json={**msg, "confirm": True})
    assert r.status_code == 502 and r.get_json()["result"] == "Token expired"


def test_scheduling_runs_once_and_whatsapp_not_scheduled(raw, monkeypatch):
    a = signup(raw)
    calls = []
    monkeypatch.setattr(channels, "send", lambda kind, cfg, text, to="": calls.append(text) or "ok")
    a.put("/api/integrations/facebook", json={"config": {"page_id": "1", "page_token": "t"}})
    a.put("/api/integrations/whatsapp", json={"config": {"phone_number_id": "1", "access_token": "t"}})
    soon = (datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat()
    far = (datetime.now(timezone.utc) + timedelta(days=200)).isoformat()
    assert a.post("/api/send", json={"channel": "whatsapp", "body": "x", "to": "15551234567", "send_at": soon, "confirm": True}).status_code == 400
    assert a.post("/api/send", json={"channel": "facebook", "body": "x", "send_at": far, "confirm": True}).status_code == 400
    r = a.post("/api/send", json={"channel": "facebook", "body": "Later", "send_at": soon, "confirm": True}).get_json()
    assert r["status"] == "scheduled" and extras.run_due() == 0 and not calls
    with db.conn() as c:
        c.x("UPDATE outbox SET send_at='2000-01-01 00:00:00'")
    assert extras.run_due() == 1 and extras.run_due() == 0 and calls == ["Later"]
    assert a.get("/api/outbox").get_json()[0]["status"] == "sent"
    r2 = a.post("/api/send", json={"channel": "facebook", "body": "Cancel me", "send_at": soon, "confirm": True}).get_json()
    assert a.delete(f"/api/outbox/{r2['id']}").status_code == 200


def test_cron_endpoint_is_protected(raw, monkeypatch):
    assert raw.get("/api/cron/run?key=x").status_code == 404
    monkeypatch.setenv("CRON_SECRET", "s3cret")
    assert raw.get("/api/cron/run?key=wrong").status_code == 404
    assert raw.get("/api/cron/run?key=s3cret").get_json() == {"sent": 0}


def test_whatsapp_number_validated():
    with pytest.raises(channels.ChannelError):
        channels.send("whatsapp", {"phone_number_id": "1", "access_token": "t"}, "hi", "12")


def test_billing_limits_and_webhook(raw, monkeypatch):
    a = signup(raw)
    assert a.post("/api/billing/checkout").status_code == 503 and a.get("/api/billing/status").get_json()["plan"] == "free"
    monkeypatch.setitem(billing.LIMITS["free"], "products", 1)
    assert a.get("/api/billing/status").get_json()["metered"] is False  # no Stripe configured: nothing is capped
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test")
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_1")
    assert a.post("/api/products", json={"name": "One"}).status_code == 201
    assert a.post("/api/products", json={"name": "Two"}).status_code == 402
    uid = a.get("/api/auth/me").get_json()["user"]["id"]
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec")

    def hook(event, secret="whsec", ts=None):
        payload = json.dumps(event).encode()
        t = str(ts or int(time.time()))
        sig = hmac.new(secret.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
        return raw.post("/api/billing/webhook", data=payload, headers={"Stripe-Signature": f"t={t},v1={sig}"})

    ev = {"type": "checkout.session.completed", "data": {"object": {"client_reference_id": str(uid), "customer": "cus_1"}}}
    assert hook(ev, secret="wrong").status_code == 400 and hook(ev, ts=1000).status_code == 400
    assert a.get("/api/billing/status").get_json()["plan"] == "free"
    assert hook(ev).status_code == 200 and a.get("/api/billing/status").get_json()["plan"] == "pro"
    assert a.post("/api/products", json={"name": "Two"}).status_code == 201
    hook({"type": "customer.subscription.deleted", "data": {"object": {"customer": "cus_1"}}})
    assert a.get("/api/billing/status").get_json()["plan"] == "free"


def test_free_channels(monkeypatch):
    calls = []
    monkeypatch.setattr(channels, "_call", lambda url, data=None, headers=None, method=None: calls.append((url, data)) or {"url": "u", "accessJwt": "j", "did": "did:x", "handle": "h", "uri": "at://x", "name": "hook", "acct": "me"})
    channels.send("mastodon", {"instance": "https://mastodon.social/", "access_token": "t"}, "Hi")
    assert calls[-1][0] == "https://mastodon.social/api/v1/statuses" and calls[-1][1] == {"status": "Hi"}
    channels.send("bluesky", {"handle": "@a.bsky.social", "app_password": "p"}, "Hi")
    assert calls[-1][0].endswith("createRecord") and calls[-1][1]["record"]["text"] == "Hi"
    channels.send("discord", {"webhook_url": "https://discord.com/api/webhooks/1/x"}, "Hi")
    assert calls[-1][1] == {"content": "Hi"}
    for bad in (("mastodon", {"instance": "http://insecure", "access_token": "t"}), ("discord", {"webhook_url": "https://evil.example/x"})):
        with pytest.raises(channels.ChannelError):
            channels.send(bad[0], bad[1], "Hi")
    with pytest.raises(channels.ChannelError):
        channels.send("bluesky", {"handle": "a", "app_password": "p"}, "x" * 301)
    assert channels.verify("mastodon", {"instance": "https://m.social", "access_token": "t"}) == "@me"
