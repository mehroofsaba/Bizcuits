"""Deterministic sales + feedback calculations (no AI)."""
import io
import pandas as pd

ALIASES = {"date": ["date", "sold_on", "order_date"], "product": ["product", "item", "product_name"],
           "quantity": ["quantity", "qty", "units"], "amount": ["amount", "total", "revenue"], "price": ["price", "unit_price"]}


def parse_csv(raw: bytes):
    """Return (rows, errors). rows are dicts ready for the sales table."""
    if not raw.strip():
        return [], ["The file is empty."]
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception:
        return [], ["This does not look like a readable CSV file."]
    df.columns = [str(c).strip().lower() for c in df.columns]
    col = {k: next((a for a in v if a in df.columns), None) for k, v in ALIASES.items()}
    errors = [f"Missing a '{k}' column." for k in ("date", "product", "quantity") if not col[k]]
    if not col["amount"] and not col["price"]:
        errors.append("Missing an 'amount' (or 'price') column.")
    if errors:
        return [], errors
    if df.empty:
        return [], ["The file has no rows."]
    out, bad = [], 0
    for i, r in df.iterrows():
        d = pd.to_datetime(r[col["date"]], errors="coerce")
        q = pd.to_numeric(r[col["quantity"]], errors="coerce")
        a = pd.to_numeric(r[col["amount"]], errors="coerce") if col["amount"] else pd.to_numeric(r[col["price"]], errors="coerce") * q
        name = str(r[col["product"]]).strip()
        if pd.isna(d) or pd.isna(q) or pd.isna(a) or q < 0 or a < 0 or name in ("", "nan"):
            bad += 1
            if bad <= 5:
                errors.append(f"Row {i + 2} has a missing or invalid value.")
            continue
        out.append({"sold_on": d.strftime("%Y-%m-%d"), "product": name, "quantity": float(q), "amount": round(float(a), 2)})
    if bad > 5:
        errors.append(f"{bad - 5} more invalid rows were skipped.")
    return out, errors


def summarize(rows):
    if not rows:
        return None
    df = pd.DataFrame(rows)
    df["month"] = df["sold_on"].str[:7]
    top = df.groupby("product").agg(units=("quantity", "sum"), total=("amount", "sum")).sort_values("total", ascending=False)
    monthly = df.groupby("month")["amount"].sum()
    return {
        "total_sales": round(float(df["amount"].sum()), 2),
        "orders": int(len(df)),
        "units": float(df["quantity"].sum()),
        "top_products": [{"product": k, "units": float(v.units), "total": round(float(v.total), 2)} for k, v in top.head(5).iterrows()],
        "monthly": [{"month": k, "total": round(float(v), 2)} for k, v in monthly.items()],
        "date_range": [df["sold_on"].min(), df["sold_on"].max()],
        "comparison": _compare(monthly),
    }


def _compare(monthly):
    """Latest month vs the month before it, calculated from the data. Says nothing about causes."""
    if len(monthly) < 2 or monthly.iloc[-2] <= 0:
        return None
    last, prev = float(monthly.iloc[-1]), float(monthly.iloc[-2])
    return {"latest_month": monthly.index[-1], "previous_month": monthly.index[-2], "latest": round(last, 2), "previous": round(prev, 2),
            "change_percent": round((last - prev) * 100 / prev, 1)}


THEMES = {
    "Product quality": ["quality", "taste", "delicious", "fresh", "broke", "damaged", "stale", "well made", "smell"],
    "Pricing": ["price", "expensive", "cheap", "worth", "value", "cost"],
    "Packaging": ["packag", "box", "wrap", "gift"],
    "Delivery": ["deliver", "shipping", "arrived", "late", "courier", "fast"],
    "Customer service": ["service", "staff", "support", "reply", "rude", "helpful", "friendly"],
    "Description clarity": ["unclear", "confus", "not as described", "misleading", "expected", "different from", "size"],
}
SUGGEST = {
    "Description clarity": "Review the product description and make size, materials and details clearer.",
    "Delivery": "Check delivery times and update your delivery information.",
    "Packaging": "Review your packaging and note what customers mention.",
    "Pricing": "Check whether your price and value are explained clearly.",
    "Product quality": "Look at the quality comments and decide what to check or improve.",
    "Customer service": "Review how you answer enquiries and update your reply policies.",
}
POS = ["love", "great", "amazing", "good", "perfect", "delicious", "best", "happy", "lovely", "excellent", "friendly", "fast"]
NEG = ["bad", "late", "broke", "damaged", "stale", "rude", "expensive", "slow", "poor", "disappointed", "worst", "missing", "wrong"]


def sentiment(text, rating=None):
    if rating:
        return "positive" if rating >= 4 else "negative" if rating <= 2 else "neutral"
    t = text.lower()
    p, n = sum(w in t for w in POS), sum(w in t for w in NEG)
    return "positive" if p > n else "negative" if n > p else "neutral"


def feedback_insights(rows):
    total = len(rows)
    if not total:
        return None
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    themes = {k: {"count": 0, "examples": []} for k in THEMES}
    for r in rows:
        counts[sentiment(r["body"], r.get("rating"))] += 1
        low = r["body"].lower()
        for name, words in THEMES.items():
            if any(w in low for w in words):
                themes[name]["count"] += 1
                if len(themes[name]["examples"]) < 3:
                    themes[name]["examples"].append({"id": r["id"], "body": r["body"]})
    return {
        "total": total,
        "sentiment": {k: {"count": v, "percent": round(v * 100 / total)} for k, v in counts.items()},
        "themes": sorted(({"name": k, **v, "percent": round(v["count"] * 100 / total), "suggestion": SUGGEST[k]} for k, v in themes.items() if v["count"]), key=lambda x: -x["count"]),
        "note": "Percentages describe the comments you added, not every customer. Sentiment is keyword-based; ratings are used when given.",
    }


def parse_feedback_csv(raw: bytes):
    """CSV with a comment column (comment/review/feedback/body/text) and optional rating."""
    if not raw.strip():
        return [], ["The file is empty."]
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception:
        return [], ["This does not look like a readable CSV file."]
    df.columns = [str(c).strip().lower() for c in df.columns]
    body = next((c for c in ("comment", "review", "feedback", "body", "text") if c in df.columns), None)
    if not body:
        return [], ["Add a column named comment, review, feedback, body or text."]
    out, skipped = [], 0
    for _, r in df.iterrows():
        t = str(r[body]).strip()
        if not t or t == "nan":
            skipped += 1
            continue
        rating = None
        if "rating" in df.columns:
            v = pd.to_numeric(r["rating"], errors="coerce")
            rating = int(v) if not pd.isna(v) and 1 <= v <= 5 else None
        out.append({"body": t[:2000], "rating": rating})
    return out[:1000], ([f"{skipped} empty rows were skipped."] if skipped else [])
