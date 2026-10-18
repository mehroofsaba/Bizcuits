"""Free, offline drafting. Used when no AI service is connected (or it is down), so every button still works.
Templates only reuse facts the user saved: they never invent prices, ingredients or policies."""
import re
from collections import Counter

STOP = set("a an and are as at be but by for from has have i in is it its me my of on or our so that the their them there these they this to was we were what when where which will with you your do does can could would should about how any if not no yes please thanks thank hi hello".split())
OPEN = {"friendly": "Meet", "professional": "Introducing", "playful": "Say hello to", "elegant": "Presenting", "concise": "New:", "warm": "Say hello to", "apologetic": "Meet"}
CTA = {"friendly": "Come say hi!", "professional": "Contact us to order.", "playful": "Grab yours before they fly off the shelf!", "elegant": "Available now.", "concise": "Order today.", "warm": "We would love to hear from you.", "apologetic": "Thank you for your patience."}


def _bits(p):
    d = [x.strip() for x in re.split(r"[,\n;]+", p.get("details") or "") if x.strip()]
    price = f"{float(p['price']):g}" if p.get("price") not in (None, "") else ""
    return d, price


def _tags(p):
    words = [w for w in re.findall(r"[A-Za-z]{3,}", f"{p['name']} {p.get('category') or ''}") if w.lower() not in STOP]
    return " ".join("#" + w.lower() for w in dict.fromkeys(words))[:80]


def product(p, mode, tone, audience=""):
    d, price = _bits(p)
    n = p["name"]
    if mode == "title":
        return "\n".join(dict.fromkeys([n, f"{n} | {p['category']}" if p.get("category") else f"The {n}", f"{n}: {d[0]}" if d else f"Meet the {n}"]))
    if mode == "keywords":
        toks = [w.lower() for w in re.findall(r"[A-Za-z][A-Za-z\-]{2,}", f"{n} {p.get('category') or ''} {p.get('details') or ''}") if w.lower() not in STOP]
        return ", ".join(w for w, _ in Counter(toks).most_common(10))
    a = f" Made for {audience}." if audience else ""
    if mode == "promo":
        return f"{OPEN.get(tone, 'Meet')} {n}{f' for {price}' if price else ''}. {(d[0] + '. ') if d else ''}{CTA.get(tone, '')}".strip()
    body = f" It features {', '.join(d[:-1]) + (' and ' if len(d) > 1 else '') + d[-1]}." if d else ""
    return f"{OPEN.get(tone, 'Meet')} {n}.{body}{a}{f' Priced at {price}.' if price else ''} {CTA.get(tone, '')}".strip()


def content(p, kind, tone):
    d, price = _bits(p)
    n, k, tags = p["name"], kind.lower(), _tags(p)
    line = f"{', '.join(d[:3])}. " if d else ""
    pr = f" {price}" if price else ""
    if "special" in k:
        return f"Today's special: {n}!{pr and ' Just' + pr + '.'} {line}{CTA.get(tone, '')}\n\n{tags}".strip()
    if "announcement" in k:
        return f"New in the shop: {n}. {line}{CTA.get(tone, '')}\n\n{tags}".strip()
    if "promotional" in k:
        return f"{OPEN.get(tone, 'Meet')} {n}{f' at {price}' if price else ''}. {line}{CTA.get(tone, '')}".strip()
    if "short" in k:
        return f"{n}: {', '.join(d[:3]) if d else 'a little something for you'}.{f' {price}.' if price else ''}"
    return f"{OPEN.get(tone, 'Meet')} {n}. {line}{CTA.get(tone, '')}\n\n{tags}".strip()


def _stem(w):
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def _words(t):
    return {_stem(w) for w in re.findall(r"[a-z]{3,}", t.lower()) if w not in STOP}


def reply(message, tone, policies):
    mw, best, score = _words(message), None, 0
    for pol in policies:
        s = len(mw & _words(pol["title"] + " " + pol["body"])) + 2 * len(mw & _words(pol["title"]))
        if s > score:
            best, score = pol, s
    greet = {"apologetic": "Thank you for getting in touch, and we are sorry for any trouble.", "professional": "Thank you for your message.", "concise": "Thanks for your message."}.get(tone, "Thanks so much for getting in touch!")
    if not best:
        return ("NEED_INFO: none of your saved policies answer this message. Add the relevant policy under Approved information, "
                "or write the answer yourself.\n\nHolding reply: " + greet + " We are looking into this and will get back to you soon.")
    return f"{greet} {best['body'].strip()} Let us know if there is anything else we can help with."


def menu(item, mode, language=""):
    n, d = item["name"], (item.get("description") or "").strip().rstrip(".")
    pr = f" for {float(item['price']):g}" if item.get("price") not in (None, "") else ""
    if mode == "translate":
        raise LookupError("Translation needs an AI connection. Set GEMMA_BACKEND on the server to enable it.")
    if mode == "simple":
        return f"{n}: {d or 'a tasty item from our menu'}."
    if mode == "delivery":
        return f"{n}{pr}. {d + '.' if d else ''} Prepared fresh to order."
    return f"Today's special: {n}{pr}! {d + '.' if d else ''} Come and get it while it lasts."


def plan(goal):
    g = goal.strip().rstrip(".")
    return [f"Decide what success looks like for: {g}", "List the products, items or people involved", "Draft the content or messages you need",
            "Pick a date to launch or publish, and put it on your calendar", "Review how it went and note what to change next time"]


def sales(s):
    top = s["top_products"][0] if s["top_products"] else None
    out = f"Your file records {s['total_sales']:g} in sales across {s['orders']} orders and {s['units']:g} units"
    out += f", between {s['date_range'][0]} and {s['date_range'][1]}."
    if top:
        out += f" {top['product']} has the highest total ({top['total']:g})."
    c = s.get("comparison")
    if c:
        out += f" {c['latest_month']} totalled {c['latest']:g} compared with {c['previous']:g} in {c['previous_month']} ({c['change_percent']:+g}%). These are recorded totals only and do not show what caused the change."
    return out


def themes(themes_list, total):
    if not themes_list:
        return f"None of the {total} comments matched a common theme yet."
    top = ", ".join(f"{t['theme']} ({t['comments']})" for t in themes_list[:3])
    return f"Across the {total} comments you added, the most common themes are {top}. This describes only the comments supplied, not every customer."
