"""Clearly labelled sample workspace (is_demo users only). Never created for real accounts."""
import secrets
from datetime import date, timedelta
import db


def seed(uid):
    P = [("Lavender Candle", "Home", 18, "Hand-poured soy wax, lavender scent, 40 hour burn"), ("Handmade Soap", "Skincare", 12, "Cold-process, oat and honey"), ("Tote Bag", "Accessories", 22, "Organic cotton, hand-printed")]
    pid = [db.create("products", uid, {"name": n, "category": c, "price": p, "details": d})["id"] for n, c, p, d in P]
    for t in ("Sample: Prepare weekend social post", "Sample: Review customer feedback"):
        db.create("tasks", uid, {"title": t, "due_date": (date.today() + timedelta(days=2)).isoformat()})
    for b, r in (("Sample: The candle smells amazing and the packaging was lovely", 5), ("Sample: Delivery was late but the soap is great quality", 3), ("Sample: A bit expensive, the description was unclear about size", 2)):
        db.create("feedback", uid, {"body": b, "rating": r, "product_id": pid[0]})
    db.create("policies", uid, {"title": "Sample: Returns", "body": "Unused items can be returned within 14 days for store credit."})
    db.create("menu_items", uid, {"name": "Sample: Honey oat cookie", "category": "Bakes", "price": 3.5, "description": "Chewy oat cookie", "ingredients": "Oats, honey, butter, flour", "allergens": "Gluten, dairy"})
    rows = [(date.today() - timedelta(days=d * 9), n, q, q * pr) for d in range(1, 9) for n, pr, q in (("Lavender Candle", 18, 1 + d % 3), ("Handmade Soap", 12, 2), ("Tote Bag", 22, 1))]
    with db.conn() as c:
        for d, n, q, a in rows:
            c.insert("sales", {"user_id": uid, "sold_on": d.isoformat(), "product": n, "quantity": q, "amount": a})
    db.log(uid, "demo", "Sample workspace created")
