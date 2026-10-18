"""Persistence for Bizcuits. SQLite by default; set DATABASE_URL to use Postgres (needed on Render's free plan,
whose disk is wiped on every restart). Every row belongs to a user, so businesses stay separate."""
import os, sqlite3
from datetime import datetime, timezone

DB_PATH = os.environ.get("BIZCUITS_DB", os.path.join(os.path.dirname(__file__), "bizcuits.db"))

COLS = {
    "users": "email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT DEFAULT '', business TEXT DEFAULT '', is_demo INTEGER DEFAULT 0, menu_slug TEXT DEFAULT '', menu_public INTEGER DEFAULT 0, plan TEXT DEFAULT 'free', stripe_customer TEXT DEFAULT '', created_at TEXT",
    "products": "user_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT DEFAULT '', price REAL, details TEXT DEFAULT '', description TEXT DEFAULT '', keywords TEXT DEFAULT '', created_at TEXT",
    "menu_items": "user_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT DEFAULT '', price REAL, description TEXT DEFAULT '', ingredients TEXT DEFAULT '', allergens TEXT DEFAULT '', created_at TEXT",
    "contents": "user_id INTEGER NOT NULL, product_id INTEGER, kind TEXT NOT NULL, tone TEXT DEFAULT '', body TEXT NOT NULL, platform TEXT DEFAULT '', campaign TEXT DEFAULT '', status TEXT DEFAULT 'draft', plan_date TEXT DEFAULT '', created_at TEXT",
    "policies": "user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT",
    "feedback": "user_id INTEGER NOT NULL, product_id INTEGER, body TEXT NOT NULL, rating INTEGER, created_at TEXT",
    "sales": "user_id INTEGER NOT NULL, sold_on TEXT NOT NULL, product TEXT NOT NULL, quantity REAL NOT NULL, amount REAL NOT NULL",
    "tasks": "user_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', due_date TEXT DEFAULT '', status TEXT DEFAULT 'open', related TEXT DEFAULT '', created_at TEXT, done_at TEXT",
    "activity": "user_id INTEGER NOT NULL, kind TEXT, text TEXT, created_at TEXT",
    "integrations": "user_id INTEGER NOT NULL, kind TEXT NOT NULL, config TEXT NOT NULL, created_at TEXT",
    "outbox": "user_id INTEGER NOT NULL, channel TEXT NOT NULL, target TEXT DEFAULT '', body TEXT NOT NULL, send_at TEXT, status TEXT DEFAULT 'scheduled', result TEXT DEFAULT '', content_id INTEGER, created_at TEXT, sent_at TEXT",
}

# table -> (required, writable, numeric)
TABLES = {
    "products": (["name"], ["name", "category", "price", "details", "description", "keywords"], ["price"]),
    "menu_items": (["name"], ["name", "category", "price", "description", "ingredients", "allergens"], ["price"]),
    "contents": (["kind", "body"], ["product_id", "kind", "tone", "body", "platform", "campaign", "status", "plan_date"], ["product_id"]),
    "policies": (["title", "body"], ["title", "body"], []),
    "feedback": (["body"], ["product_id", "body", "rating"], ["product_id", "rating"]),
    "tasks": (["title"], ["title", "description", "due_date", "status", "related"], []),
}
USER_TABLES = list(TABLES) + ["sales", "activity", "integrations", "outbox"]


class ValidationError(ValueError):
    pass


def pg():
    return bool(os.environ.get("DATABASE_URL"))


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class _Conn:
    """Tiny wrapper so the rest of the code writes SQL with ? placeholders for both databases."""

    def __init__(self):
        if pg():
            import psycopg2, psycopg2.extras
            url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
            self.c = psycopg2.connect(url)
            self.cur = self.c.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            self.c = sqlite3.connect(DB_PATH)
            self.c.row_factory = sqlite3.Row
            self.cur = self.c.cursor()

    def __enter__(self):
        return self

    def __exit__(self, et, *_):
        self.c.commit() if et is None else self.c.rollback()
        self.c.close()

    def x(self, sql, params=()):
        self.cur.execute(sql.replace("?", "%s") if pg() else sql, params)
        return self

    def all(self):
        return [dict(r) for r in self.cur.fetchall()]

    def one(self):
        r = self.cur.fetchone()
        return dict(r) if r else None

    @property
    def count(self):
        return self.cur.rowcount

    def insert(self, table, d):
        cols = ",".join(d)
        ph = ",".join("?" * len(d))
        if pg():
            self.x(f"INSERT INTO {table}({cols}) VALUES({ph}) RETURNING id", list(d.values()))
            return self.cur.fetchone()["id"]
        self.x(f"INSERT INTO {table}({cols}) VALUES({ph})", list(d.values()))
        return self.cur.lastrowid


def conn():
    return _Conn()


def init():
    pk = "SERIAL PRIMARY KEY" if pg() else "INTEGER PRIMARY KEY"
    with conn() as c:
        for t, cols in COLS.items():
            c.x(f"CREATE TABLE IF NOT EXISTS {t}(id {pk}, {cols})")
    # upgrade databases created by earlier versions
    for col in ("plan TEXT DEFAULT 'free'", "stripe_customer TEXT DEFAULT ''"):
        try:
            with conn() as c:
                c.x(f"ALTER TABLE users ADD COLUMN {'IF NOT EXISTS ' if pg() else ''}{col}")
        except Exception:
            pass


def log(uid, kind, text):
    with conn() as c:
        c.insert("activity", {"user_id": uid, "kind": kind, "text": text, "created_at": now()})


def _clean(table, data, partial=False):
    required, fields, numeric = TABLES[table]
    out = {}
    for f in fields:
        if f not in data:
            continue
        v = data[f]
        if isinstance(v, str):
            v = v.strip()
        if f in numeric:
            if v in ("", None):
                v = None
            else:
                try:
                    v = float(v) if f == "price" else int(v)
                except (TypeError, ValueError):
                    raise ValidationError(f"{f} must be a number")
                if f == "price" and v < 0:
                    raise ValidationError("price cannot be negative")
                if f == "rating" and not 1 <= v <= 5:
                    raise ValidationError("rating must be between 1 and 5")
        if f == "status" and table == "tasks" and v not in ("open", "done"):
            raise ValidationError("status must be open or done")
        if f == "status" and table == "contents" and v not in ("draft", "scheduled", "posted"):
            raise ValidationError("status must be draft, scheduled or posted")
        out[f] = v
    if not partial:
        for f in required:
            if not out.get(f):
                raise ValidationError(f"{f} is required")
    elif any(f in out and not out[f] for f in required):
        raise ValidationError("required fields cannot be empty")
    return out


def list_rows(table, uid, order="id DESC"):
    with conn() as c:
        return c.x(f"SELECT * FROM {table} WHERE user_id=? ORDER BY {order}", (uid,)).all()


def get(table, uid, id_):
    with conn() as c:
        return c.x(f"SELECT * FROM {table} WHERE id=? AND user_id=?", (id_, uid)).one()


def create(table, uid, data):
    d = _clean(table, data)
    d["user_id"] = uid
    if table != "sales":
        d["created_at"] = now()
    with conn() as c:
        new_id = c.insert(table, d)
    return get(table, uid, new_id)


def update(table, uid, id_, data):
    d = _clean(table, data, partial=True)
    if not d:
        raise ValidationError("nothing to update")
    if table == "tasks" and "status" in d:
        d["done_at"] = now() if d["status"] == "done" else None
    with conn() as c:
        c.x(f"UPDATE {table} SET {','.join(k + '=?' for k in d)} WHERE id=? AND user_id=?", list(d.values()) + [id_, uid])
        if c.count == 0:
            return None
    return get(table, uid, id_)


def delete(table, uid, id_):
    with conn() as c:
        return c.x(f"DELETE FROM {table} WHERE id=? AND user_id=?", (id_, uid)).count > 0


def delete_user(uid):
    with conn() as c:
        for t in USER_TABLES:
            c.x(f"DELETE FROM {t} WHERE user_id=?", (uid,))
        c.x("DELETE FROM users WHERE id=?", (uid,))
