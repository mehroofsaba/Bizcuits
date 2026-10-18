"""Outbound channels. Nothing here runs unless the signed-in user approves a send (see extras.py). Credentials are per user."""
import json, urllib.error, urllib.parse, urllib.request

GRAPH = "https://graph.facebook.com/v21.0"

FIELDS = {
    "facebook": {"label": "Facebook Page", "fields": [("page_id", "Page ID"), ("page_token", "Page access token")]},
    "telegram": {"label": "Telegram channel or chat", "fields": [("bot_token", "Bot token"), ("chat_id", "Channel or chat ID (e.g. @mychannel)")]},
    "mastodon": {"label": "Mastodon", "fields": [("instance", "Instance URL (e.g. https://mastodon.social)"), ("access_token", "Access token")]},
    "bluesky": {"label": "Bluesky", "fields": [("handle", "Handle (e.g. shop.bsky.social)"), ("app_password", "App password")]},
    "discord": {"label": "Discord channel", "fields": [("webhook_url", "Webhook URL")]},
    "whatsapp": {"label": "WhatsApp Business", "fields": [("phone_number_id", "Phone number ID"), ("access_token", "Access token")]},
}


class ChannelError(Exception):
    pass


def _call(url, data=None, headers=None, method=None):
    h = dict(headers or {})
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, body, h, method=method), timeout=20) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read())
            msg = (err.get("error") or {}).get("message") if isinstance(err.get("error"), dict) else err.get("description") or err.get("error")
        except Exception:
            msg = None
        raise ChannelError(str(msg or f"The service refused the request ({e.code})."))
    except (urllib.error.URLError, TimeoutError):
        raise ChannelError("Could not reach the service. Try again.")


def verify(kind, cfg):
    """Read-only check that the saved credentials work. Posts nothing."""
    if kind == "facebook":
        d = _call(f"{GRAPH}/{cfg['page_id']}?fields=name&access_token={urllib.parse.quote(cfg['page_token'])}")
        return d.get("name", "Page connected")
    if kind == "telegram":
        d = _call(f"https://api.telegram.org/bot{cfg['bot_token']}/getMe")
        return "@" + d.get("result", {}).get("username", "bot")
    if kind == "whatsapp":
        d = _call(f"{GRAPH}/{cfg['phone_number_id']}?fields=display_phone_number", headers={"Authorization": "Bearer " + cfg["access_token"]})
        return d.get("display_phone_number", "Number connected")
    if kind == "mastodon":
        d = _call(_inst(cfg) + "/api/v1/accounts/verify_credentials", headers={"Authorization": "Bearer " + cfg["access_token"]})
        return "@" + d.get("acct", "account")
    if kind == "bluesky":
        return "@" + _bsky(cfg)[2]
    if kind == "discord":
        _hook(cfg)
        return _call(cfg["webhook_url"]).get("name", "Webhook connected")
    raise ChannelError("Unknown channel.")


def _inst(cfg):
    u = cfg["instance"].strip().rstrip("/")
    if not u.startswith("https://"):
        raise ChannelError("The instance URL must start with https://")
    return u


def _hook(cfg):
    if not cfg["webhook_url"].startswith(("https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/")):
        raise ChannelError("That does not look like a Discord webhook URL.")


def _bsky(cfg):
    d = _call("https://bsky.social/xrpc/com.atproto.server.createSession", {"identifier": cfg["handle"].lstrip("@"), "password": cfg["app_password"]})
    return d["accessJwt"], d["did"], d.get("handle", cfg["handle"])


def send(kind, cfg, text, to=""):
    """Send one message. Returns a short result string."""
    if kind == "facebook":
        d = _call(f"{GRAPH}/{cfg['page_id']}/feed", {"message": text, "access_token": cfg["page_token"]})
        return "Posted to Facebook Page (id " + str(d.get("id", "?")) + ")"
    if kind == "telegram":
        d = _call(f"https://api.telegram.org/bot{cfg['bot_token']}/sendMessage", {"chat_id": cfg["chat_id"], "text": text})
        return "Sent on Telegram (message " + str(d.get("result", {}).get("message_id", "?")) + ")"
    if kind == "mastodon":
        d = _call(_inst(cfg) + "/api/v1/statuses", {"status": text}, headers={"Authorization": "Bearer " + cfg["access_token"]})
        return "Posted on Mastodon (" + str(d.get("url", "ok")) + ")"
    if kind == "bluesky":
        if len(text) > 300:
            raise ChannelError("Bluesky posts are limited to 300 characters. Shorten the text.")
        jwt, did, _ = _bsky(cfg)
        d = _call("https://bsky.social/xrpc/com.atproto.repo.createRecord", {"repo": did, "collection": "app.bsky.feed.post",
                  "record": {"$type": "app.bsky.feed.post", "text": text, "createdAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z")}},
                  headers={"Authorization": "Bearer " + jwt})
        return "Posted on Bluesky (" + str(d.get("uri", "ok")) + ")"
    if kind == "discord":
        _hook(cfg)
        if len(text) > 2000:
            raise ChannelError("Discord messages are limited to 2000 characters.")
        _call(cfg["webhook_url"] + "?wait=true", {"content": text})
        return "Posted to Discord"
    if kind == "whatsapp":
        digits = "".join(ch for ch in to if ch.isdigit())
        if len(digits) < 8:
            raise ChannelError("Enter the customer's phone number with country code.")
        d = _call(f"{GRAPH}/{cfg['phone_number_id']}/messages", {"messaging_product": "whatsapp", "to": digits, "type": "text", "text": {"body": text}},
                  headers={"Authorization": "Bearer " + cfg["access_token"]})
        return "Sent on WhatsApp (id " + str((d.get("messages") or [{}])[0].get("id", "?")) + ")"
    raise ChannelError("Unknown channel.")
