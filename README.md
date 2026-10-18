# Bizcuits

*A little something for every business thing.*

An AI-assisted workspace for small sellers: product copy, menus, content calendar, customer replies, feedback insights, sales analytics and tasks. React + Vite frontend, Flask backend, Pandas for calculations, Gemma for language tasks.

## Run locally
```bash
cd backend && pip install -r requirements.txt
cp .env.example .env              # optional: add Gemma settings
python app.py                     # API on http://localhost:5000

cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api)
```
Local data goes to `backend/bizcuits.db` (SQLite). Open the app and choose **Try the sample workspace**, or create an account.

## Deploy on Render (free plan)
1. Push this repo to GitHub (keep `frontend/dist`; run `npm run build` in `frontend/` first if you changed the UI).
2. **Database:** create a free Postgres at Neon or Supabase and copy its connection string. Render's free plan has no persistent disk, so without this your data is wiped whenever the service restarts.
3. **AI:** get a free key from Google AI Studio. It serves hosted Gemma models (default `gemma-3-27b-it`).
4. In Render: **New > Blueprint**, pick the repo (it reads `render.yaml`). Set `DATABASE_URL` and `GEMINI_API_KEY`. `SECRET_KEY` is generated for you.
5. Visit `/api/health`: it should show `"database": "postgres"` and `"ai_configured": true`.

Free-plan facts: the service sleeps after about 15 minutes idle, so the first request can take around a minute; free AI tiers have rate limits (Bizcuits also caps each user at 40 AI requests per hour, set `AI_LIMIT_PER_HOUR` to change it). Free Render-hosted Postgres expires after 30 days, so use Neon or Supabase for long-term data.

## Runs with no paid services
Everything works with zero keys and zero cost:
- **No AI key:** every AI button still works using free built-in templates that only reuse the details you saved (replies use only your saved policies and say when they cannot answer). Translation is the one thing that needs a real AI connection. Add a free Google AI Studio key later to switch on Gemma; if Gemma is down, Bizcuits falls back to the templates.
- **No email service:** password reset links are written to the server logs (Render > Logs) so the site owner can send them on. Add a free Resend key to email them automatically.
- **No Stripe:** nobody can upgrade, so no plan limits are applied.
- **Free posting channels:** Mastodon, Bluesky and Discord (plus Telegram) need no business approval or fees.
- **Free extras:** calendar export (.ics), printable and shareable menus, CSV templates and exports, a full data download, installable as an app on a phone (web app manifest).

## Integrations (all optional; each works once its keys are set)
Set these in Render's Environment tab. Anything left empty simply shows a clear "not set up" message in the app.

| Feature | What to set | Notes |
|---|---|---|
| Password reset email | `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` | Render's free plan blocks SMTP, so Bizcuits uses Resend's HTTPS API (free tier). Until you verify your own domain at Resend, it can only email your own address. `SMTP_*` works on hosts that allow SMTP. |
| Facebook Page, Telegram, Mastodon, Bluesky, Discord, WhatsApp | Nothing on the server | Each user pastes their own tokens in **Connections**; they are encrypted with a key derived from `SECRET_KEY`, so keep that value stable. |
| Scheduled posts | `CRON_SECRET` (generated) | Render free sleeps when idle and a sleeping server cannot send. Create a free cron-job.org job that calls `https://YOUR-APP.onrender.com/api/cron/run?key=CRON_SECRET` every 5 minutes. It also keeps the service awake. |
| Payments (Pro plan) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` | Create a recurring Price in Stripe. Add a webhook to `https://YOUR-APP.onrender.com/api/billing/webhook` for `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`. |

How sending works: nothing is ever sent automatically. Each post or WhatsApp message needs the user to press send and confirm. Scheduling is available for every posting channel (not WhatsApp); WhatsApp replies always go out immediately after confirmation. Every send is listed in the Outbox with its result. Plan limits (free vs Pro) are in `backend/billing.py`.

These integrations call live third-party APIs. They are covered by automated tests with the network calls replaced, but they were not run against real Facebook, Telegram, WhatsApp, Resend or Stripe accounts here, so test each once with your own accounts. Meta and WhatsApp require app review and business verification before posting to other people's pages or messaging customers.

## AI honesty
Gemma writes drafts only: descriptions, captions, replies, translations, summaries and task ideas. Every result is editable and nothing is sent or posted automatically. Totals, percentages, sentiment counts and comparisons come from ordinary code. Hosted inference sends the text of the requested item to Google's API; self-hosting through Ollama (`GEMMA_BACKEND=ollama`) keeps it on your machine. Do not describe a deployment as running Gemma locally unless it does.

## Architecture
- `backend/`: `db.py` (SQLite or Postgres, per-user rows), `auth.py` (accounts, signed tokens), `ai.py` (prompts + Gemma), `analytics.py` (Pandas), `seed.py` (labelled sample data), `app.py` (routes).
- `frontend/src/`: `ui.jsx` shared components, `pages/` one file per screen, `styles.css` tokens + four themes.
- Data separation: every table has a `user_id`; every query filters by it (tested). Public menus are opt-in via a random link.

## Data and privacy
Each account owns its data. Settings lets users download everything as JSON or delete the account and all rows. Imported CSV rows stay until cleared. Passwords are hashed; tokens expire after 30 days.

## Tests
`cd backend && pytest` (21 tests) · `cd frontend && npm test` (15 tests)

## Not built yet
Instagram and X posting (they need image uploads or paid API access), offline translation, WhatsApp message templates, payment tracking for your own customers' orders (billing here is for Bizcuits subscriptions), and automated tests against a live Postgres.
