"""Accounts: password hashing + signed tokens. Each request is scoped to g.uid."""
import os, re, secrets
from functools import wraps
from flask import g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash
import db

MAX_AGE = 60 * 60 * 24 * 30


def _ser():
    return URLSafeTimedSerializer(os.environ.get("SECRET_KEY", "dev-only-change-me"))


def token_for(uid):
    return _ser().dumps({"uid": uid})


def public(u):
    return {k: u[k] for k in ("id", "email", "name", "business", "is_demo", "menu_slug", "menu_public", "plan")}


def require_user(fn):
    @wraps(fn)
    def wrapper(*a, **k):
        h = request.headers.get("Authorization", "")
        try:
            uid = _ser().loads(h.removeprefix("Bearer ").strip(), max_age=MAX_AGE)["uid"]
        except (BadSignature, SignatureExpired, KeyError):
            return jsonify(error="Please sign in again.", auth=True), 401
        with db.conn() as c:
            u = c.x("SELECT * FROM users WHERE id=?", (uid,)).one()
        if not u:
            return jsonify(error="Please sign in again.", auth=True), 401
        g.uid, g.user = uid, u
        return fn(*a, **k)
    return wrapper


def register(email, password, name="", business="", demo=False):
    email = (email or "").strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise db.ValidationError("Enter a valid email address.")
    if len(password or "") < 8:
        raise db.ValidationError("Password must be at least 8 characters.")
    with db.conn() as c:
        if c.x("SELECT id FROM users WHERE email=?", (email,)).one():
            raise db.ValidationError("An account with this email already exists.")
        uid = c.insert("users", {"email": email, "password_hash": generate_password_hash(password), "name": name.strip(), "business": business.strip(),
                                 "is_demo": 1 if demo else 0, "menu_slug": secrets.token_urlsafe(8).lower().replace("_", "x").replace("-", "y"), "created_at": db.now()})
    return uid


def login(email, password):
    with db.conn() as c:
        u = c.x("SELECT * FROM users WHERE email=?", ((email or "").strip().lower(),)).one()
    if not u or not check_password_hash(u["password_hash"], password or ""):
        raise db.ValidationError("Email or password is not right.")
    return u["id"]
