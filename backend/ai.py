"""Gemma integration + prompt construction. AI output is always a suggestion for the user to review."""
import json, os, urllib.request, urllib.error


class AIUnavailable(Exception):
    pass


SYSTEM = (
    "You are Bizcuits, a writing assistant for small businesses. Use ONLY the facts provided. "
    "Never invent prices, ingredients, materials, certifications, allergen claims, policies, refunds or delivery dates. "
    "If something is not provided, leave it out. Keep the writing warm, clear and concise."
)


def configured():
    b = os.environ.get("GEMMA_BACKEND", "").lower()
    return b == "ollama" or (b == "gemini" and bool(os.environ.get("GEMINI_API_KEY")))


def generate(prompt, timeout=60):
    backend = os.environ.get("GEMMA_BACKEND", "").lower()
    model = os.environ.get("GEMMA_MODEL", "gemma3:4b")
    full = f"{SYSTEM}\n\n{prompt}"
    try:
        if backend == "ollama":
            url = os.environ.get("OLLAMA_URL", "http://localhost:11434") + "/api/generate"
            body = {"model": model, "prompt": full, "stream": False}
            data = _post(url, body, timeout)
            text = data.get("response", "")
        elif backend == "gemini":
            key = os.environ.get("GEMINI_API_KEY")
            if not key:
                raise AIUnavailable("GEMINI_API_KEY is not set.")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            data = _post(url, {"contents": [{"parts": [{"text": full}]}]}, timeout)
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        else:
            raise AIUnavailable("AI is not configured. Set GEMMA_BACKEND in backend/.env (see .env.example).")
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, json.JSONDecodeError):
        raise AIUnavailable("The AI service did not respond. Check the model service and try again.")
    text = (text or "").strip()
    if not text:
        raise AIUnavailable("The AI returned an empty answer. Try again.")
    return text


def _post(url, body, timeout):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def _facts(p):
    parts = [f"Name: {p['name']}"]
    for label, k in (("Category", "category"), ("Price", "price"), ("Details", "details")):
        if p.get(k) not in (None, ""):
            parts.append(f"{label}: {p[k]}")
    return "\n".join(parts)


def product_prompt(p, mode, tone, audience=""):
    task = {
        "description": "Write a product description of 50-90 words.",
        "title": "Write 3 alternative product titles, one per line.",
        "keywords": "Write 10 search keywords, comma separated.",
        "promo": "Write a short promotional message of 30-50 words.",
    }[mode]
    aud = f" Audience: {audience}." if audience else ""
    return f"{task} Tone: {tone}.{aud}\n\nProduct facts:\n{_facts(p)}"


def content_prompt(p, kind, tone):
    return f"Write a {kind} for this product. Tone: {tone}. Add no facts beyond those listed. Plain text only.\n\nProduct facts:\n{_facts(p)}"


def reply_prompt(message, tone, policies):
    ref = "\n".join(f"- {x['title']}: {x['body']}" for x in policies) or "(none supplied)"
    return (
        f"Draft a customer reply. Tone: {tone}.\nApproved business information:\n{ref}\n\nCustomer message:\n{message}\n\n"
        "Rules: only state policies listed above. If the information is not enough to answer, begin the output with "
        "NEED_INFO: followed by what the owner must confirm, then give a safe holding reply that promises nothing."
    )


def menu_prompt(item, mode, language):
    facts = "\n".join(f"{k}: {item[k]}" for k in ("name", "category", "price", "description", "ingredients", "allergens") if item.get(k) not in (None, ""))
    task = {
        "translate": f"Translate the item name and description into {language}. Do not add anything.",
        "simple": "Rewrite the description in simple words anyone can understand.",
        "delivery": "Write a delivery-platform description of under 40 words.",
        "special": "Write a short daily-special announcement.",
    }[mode]
    return f"{task} Never claim the item is allergen-free or suitable for any diet.\n\nItem:\n{facts}"


def plan_prompt(goal):
    return f"Break this goal into 4-6 small practical tasks. One task per line, no numbering. These are suggestions only.\nGoal: {goal}"


def explain_prompt(summary):
    return ("Explain these calculated sales results in plain language in under 120 words. Use only the numbers given. "
            "Do not claim any cause for changes.\n" + json.dumps(summary))


def themes_prompt(themes, total):
    return (f"Summarize these customer feedback themes from {total} comments in under 100 words. "
            "Talk about the supplied comments only, not all customers.\n" + json.dumps(themes))
