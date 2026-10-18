import io, os, sys
import pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import db, analytics
from app import create_app


class C:
    def __init__(self, cl, h=None):
        self.cl, self.h = cl, h or {}

    def __getattr__(self, m):
        return lambda *a, **k: getattr(self.cl, m)(*a, headers=self.h, **k)


def signup(cl, email="a@example.com"):
    r = cl.post("/api/auth/register", json={"email": email, "password": "password1"}).get_json()
    return C(cl, {"Authorization": "Bearer " + r["token"]})


@pytest.fixture
def raw(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    monkeypatch.delenv("GEMMA_BACKEND", raising=False)
    return create_app().test_client()


@pytest.fixture
def client(raw):
    return signup(raw)


def test_auth_required_and_validation(raw):
    assert raw.get("/api/products").status_code == 401
    assert raw.post("/api/auth/register", json={"email": "bad", "password": "password1"}).status_code == 400
    assert raw.post("/api/auth/register", json={"email": "a@b.co", "password": "short"}).status_code == 400
    signup(raw, "x@y.co")
    assert raw.post("/api/auth/register", json={"email": "x@y.co", "password": "password1"}).status_code == 400
    assert raw.post("/api/auth/login", json={"email": "x@y.co", "password": "nope"}).status_code == 400
    assert raw.post("/api/auth/login", json={"email": "x@y.co", "password": "password1"}).get_json()["token"]


def test_businesses_are_separated(raw):
    a, b = signup(raw, "a@a.co"), signup(raw, "b@b.co")
    p = a.post("/api/products", json={"name": "Candle"}).get_json()
    assert b.get("/api/products").get_json() == []
    assert b.delete(f"/api/products/{p['id']}").status_code == 404
    assert b.put(f"/api/products/{p['id']}", json={"name": "x"}).status_code == 404
    assert len(a.get("/api/products").get_json()) == 1


def test_product_crud_and_validation(client):
    assert client.post("/api/products", json={"name": ""}).status_code == 400
    p = client.post("/api/products", json={"name": "Candle", "price": "18"}).get_json()
    assert p["price"] == 18.0
    assert client.put(f"/api/products/{p['id']}", json={"description": "Cozy"}).get_json()["description"] == "Cozy"
    assert client.post("/api/products", json={"name": "x", "price": "abc"}).status_code == 400
    assert client.delete(f"/api/products/{p['id']}").status_code == 200
    assert client.get("/api/products").get_json() == []


def test_task_complete_overdue_activity(client):
    t = client.post("/api/tasks", json={"title": "Post", "due_date": "2000-01-01"}).get_json()
    assert client.get("/api/dashboard").get_json()["overdue"] == 1
    assert client.put(f"/api/tasks/{t['id']}", json={"status": "done"}).get_json()["status"] == "done"
    d = client.get("/api/dashboard").get_json()
    assert d["overdue"] == 0 and d["completed"][0]["title"] == "Post" and any("Completed" in a["text"] for a in d["activity"])


def test_calendar_fields(client):
    c = client.post("/api/content", json={"kind": "Caption", "body": "Hi", "platform": "Instagram", "plan_date": "2026-11-01", "status": "scheduled"}).get_json()
    assert c["status"] == "scheduled" and client.put(f"/api/content/{c['id']}", json={"status": "bogus"}).status_code == 400


def test_builtin_drafts_work_without_ai(client):
    p = client.post("/api/products", json={"name": "Lavender Candle", "price": "18", "details": "soy wax, lavender scent"}).get_json()
    r = client.post("/api/ai/product", json={"product_id": p["id"], "tone": "friendly"}).get_json()
    assert r["source"] == "template" and "Lavender Candle" in r["text"] and "soy wax" in r["text"] and "18" in r["text"]
    kw = client.post("/api/ai/product", json={"product_id": p["id"], "mode": "keywords"}).get_json()["text"]
    assert "lavender" in kw
    assert client.post("/api/ai/content", json={"product_id": p["id"], "kind": "Daily special post"}).get_json()["text"].startswith("Today's special")
    m = client.post("/api/menu", json={"name": "Cookie"}).get_json()
    r = client.post("/api/ai/menu", json={"item_id": m["id"], "mode": "translate"})
    assert r.status_code == 503 and r.get_json()["ai_unavailable"]


def test_reply_uses_only_saved_policies(client):
    client.post("/api/policies", json={"title": "Returns", "body": "Unused items can be returned within 14 days."})
    ok = client.post("/api/ai/reply", json={"message": "Can I return my order?"}).get_json()
    assert not ok["needs_info"] and "14 days" in ok["text"]
    no = client.post("/api/ai/reply", json={"message": "Do you ship to Mars?"}).get_json()
    assert no["needs_info"] and no["text"].startswith("NEED_INFO")
    assert "14 days" not in no["text"]


def test_plan_and_explanations_without_ai(client):
    assert len(client.post("/api/ai/plan", json={"goal": "Launch holiday range"}).get_json()["steps"]) == 5
    assert client.post("/api/ai/explain-sales").status_code == 400


def test_csv_valid_and_invalid():
    rows, err = analytics.parse_csv(b"date,product,quantity,amount\n2026-01-02,Soap,2,24\n2026-02-03,Candle,1,18\n2026-02-05,Soap,1,12\n")
    s = analytics.summarize(rows)
    assert not err and s["total_sales"] == 54 and s["comparison"]["change_percent"] == 25.0
    assert analytics.parse_csv(b"")[1]
    assert "Missing a 'date' column." in analytics.parse_csv(b"product,quantity,amount\nA,1,2\n")[1]
    assert not analytics.parse_csv(b"date,product,quantity,amount\nnope,Soap,2,24\n")[0]


def test_uploads(client):
    s = {"file": (io.BytesIO(b"date,product,quantity,amount\n2026-01-02,Soap,2,24\n"), "s.csv")}
    assert client.post("/api/sales/upload", data=s, content_type="multipart/form-data").get_json()["imported"] == 1
    assert client.get("/api/sales/summary").get_json()["total_sales"] == 24
    f = {"file": (io.BytesIO(b"review,rating\nLove it,5\nToo late,1\n"), "f.csv")}
    assert client.post("/api/feedback/import", data=f, content_type="multipart/form-data").get_json()["imported"] == 2
    bad = {"file": (io.BytesIO(b"x,y\n1,2\n"), "f.csv")}
    assert client.post("/api/feedback/import", data=bad, content_type="multipart/form-data").status_code == 400


def test_feedback_insights_and_suggestions(client):
    for t in ["Love the packaging", "Delivery was late", "Great quality, fast delivery", "The size was unclear"]:
        client.post("/api/feedback", json={"body": t})
    ins = client.get("/api/feedback/insights").get_json()
    names = {t["name"]: t for t in ins["themes"]}
    assert ins["total"] == 4 and names["Delivery"]["count"] == 2 and "Description clarity" in names and names["Delivery"]["suggestion"]


def test_public_menu_share_and_demo_and_delete(raw):
    c = signup(raw)
    c.post("/api/menu", json={"name": "Cookie", "allergens": "Gluten"})
    slug = c.get("/api/auth/me").get_json()["user"]["menu_slug"]
    assert raw.get(f"/api/public/menu/{slug}").status_code == 404
    c.post("/api/menu/share", json={"enabled": True})
    assert raw.get(f"/api/public/menu/{slug}").get_json()["items"][0]["name"] == "Cookie"
    d = raw.post("/api/auth/demo").get_json()
    dc = C(raw, {"Authorization": "Bearer " + d["token"]})
    assert d["user"]["is_demo"] and dc.get("/api/products").get_json()[0]["name"]
    assert c.get("/api/export").get_json()["menu_items"]
    assert c.delete("/api/auth/account").status_code == 200
    assert c.get("/api/products").status_code == 401
