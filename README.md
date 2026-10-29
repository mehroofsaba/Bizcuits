# Bizcuits

*A little something for every business thing.*

Bizcuits is an AI-assisted business workspace designed for small sellers, independent creators, and people running small businesses or side hustles. It brings everyday business tasks — from writing product descriptions to understanding sales data — into one organized workspace.

Instead of switching between multiple tools, users can manage their products, build menus, create marketing content, respond to customers, analyze feedback, track sales, and organize tasks in one place.

The goal is simple: make running a small business feel a little less overwhelming.

## What Bizcuits Offers

### 1. Dashboard

A central workspace that brings important business information together.

- View an overview of your workspace and business activity.
- Access frequently used tools and sections from one place.
- Work with sample data to explore the application before adding your own information.
- Navigate between products, content, customers, analytics, tasks, and integrations.

### 2. Product Studio

Create and maintain an organized catalogue of your products or services.

- Add, edit, and manage product information.
- Store details such as product names, descriptions, prices, and other relevant information.
- Generate AI-assisted product descriptions based on the details you provide.
- Edit generated copy before using it anywhere.
- Keep product information organized for use throughout your business workflow.

**How it works:** Product details are stored in the application database. AI-assisted writing uses the information supplied with your request to create a draft, rather than requiring you to start from a blank page.

### 3. Menu & Catalogue Builder

Turn your products or services into a menu or shareable catalogue.

- Organize items into a customer-friendly menu.
- Create printable and shareable menus.
- Publish a public menu through an optional shareable link.
- Export or print menu information for use outside the application.

Public sharing is optional. A menu is not intended to become public unless the relevant sharing feature is enabled.

### 4. Content Studio

Plan and create marketing content for your business.

- Generate draft captions and promotional copy.
- Organize content ideas and planned posts.
- Maintain a content calendar.
- Prepare content for supported publishing channels.
- Edit drafts before sending or publishing them.

**How it works:** The AI generates text based on the context you provide. The content remains editable, and supported publishing integrations require you to review and confirm the action.

### 5. Customer Replies

Get help drafting responses to customer questions and feedback.

- Generate suggested replies to customer messages.
- Use saved business policies and information to guide responses.
- Keep replies consistent with the information you have provided.
- Review and edit suggested messages before sending them.

The reply assistant is designed to avoid inventing business policies or unsupported details. When the available information is insufficient, the response workflow can indicate that more information is needed.

### 6. Feedback Insights

Make customer feedback easier to understand.

- Review feedback collected in your workspace.
- Examine sentiment summaries and feedback patterns.
- View sentiment counts and percentages.
- Identify recurring themes that may deserve attention.

**How it works:** Sentiment summaries and numerical calculations are produced by application code. AI may assist with language-based summaries, but it does not replace the underlying calculations.

### 7. Sales Analytics

Understand your business data using CSV imports and calculated metrics.

- Import supported sales CSV files.
- Analyze sales figures and relevant business metrics.
- Calculate totals, percentages, comparisons, and summaries.
- Export data or use CSV templates to prepare future imports.

**How it works:** Pandas handles supported data processing and calculations. Numerical results come from the data and application logic, rather than being guessed by the language model.

Always review imported data and calculated results before using them for business decisions.

### 8. Tasks & Business Organization

Keep track of work that needs to be done.

- Create and manage business tasks.
- Organize outstanding work and task status.
- Use AI-assisted task ideas where supported.
- Keep routine business activities in one workspace.

The task manager helps organize work; AI-generated suggestions are drafts that you can change to suit your workflow.

### 9. Connections & Integrations

Connect Bizcuits to supported third-party platforms when you are ready.

The integrations currently represented in the project include:

- **Facebook Pages**
- **Telegram**
- **Mastodon**
- **Bluesky**
- **Discord**
- **WhatsApp**
- **Resend** for email delivery
- **Stripe** for Bizcuits subscription billing

The application also includes scheduled-post workflows, an Outbox for tracking send attempts and results, and a cron endpoint for scheduled work.

Integration availability depends on the credentials, permissions, configuration, and platform requirements involved. Some services require additional app review or business verification.

**Important:** These integrations have automated tests, but they have not all been verified against live third-party accounts. Configure and test each integration with your own authorized accounts before relying on it.

### 10. Settings, Privacy & Data Management

Bizcuits includes account and data-management features designed to give users control over their workspace.

- Create an account and authenticate.
- Keep workspace records associated with their owning user.
- Download supported account data as JSON.
- Delete an account and its associated application records through the account-management workflow.
- Use optional public-menu sharing.
- Configure account and integration settings.

Passwords are hashed, authentication tokens expire after 30 days, and application queries are designed to restrict private records to their owning user.

These application-level controls are not a substitute for secure deployment, careful secret management, or reviewing the security of a production installation.

### 11. Additional Utilities

Bizcuits also includes several useful tools for everyday workflows:

- Calendar export in `.ics` format.
- Printable and shareable menus.
- CSV templates and exports.
- Full account-data export.
- An installable web-app manifest for compatible devices.

These utilities help make information created in Bizcuits useful outside the application as well.

---

## How AI Works in Bizcuits

Bizcuits uses Gemma for supported language tasks, including:

- Product descriptions.
- Marketing captions.
- Customer replies.
- Translations.
- Summaries.
- Task suggestions.

The application supports a hosted Google AI Studio connection for Gemma and a configurable Ollama backend for self-hosted inference.

AI-generated content is treated as a **draft, not an unquestionable answer**. Users can review and edit the result before using it.

Numerical analytics — including totals, percentages, sentiment counts, and comparisons — are calculated by application code. The language model is not used as the source of truth for those figures.

When hosted inference is enabled, the text required for a request is sent to the configured AI provider. With a properly configured self-hosted Ollama setup, inference can run on your own machine or server instead. The actual data flow depends on the selected configuration.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Interactive application interface |
| Build tooling | Vite | Frontend development and production builds |
| Backend | Python, Flask | API endpoints and application logic |
| Data processing | Pandas | CSV processing and numerical analytics |
| AI | Gemma | Language generation and assistance |
| Local database | SQLite | Local application data storage |
| Production database support | PostgreSQL | Persistent relational data storage |
| Testing | pytest | Backend tests |
| Frontend testing | Vitest | Frontend component and API-related tests |
| Integrations | Third-party APIs | Messaging, publishing, email, and billing workflows |

## Project Structure

```text
Bizcuits/
├── backend/
│   ├── app.py
│   ├── ai.py
│   ├── analytics.py
│   ├── auth.py
│   ├── billing.py
│   ├── channels.py
│   ├── db.py
│   ├── extras.py
│   ├── fallback.py
│   ├── mailer.py
│   ├── seed.py
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── ui.jsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.js
├── render.yaml
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

### Architecture Overview

- `backend/app.py` defines the Flask application and API routes.
- `backend/db.py` manages database access and supported database configurations.
- `backend/auth.py` handles account authentication.
- `backend/ai.py` manages AI-assisted language tasks.
- `backend/analytics.py` contains analytics and data-processing logic.
- `backend/billing.py` handles Bizcuits subscription-related functionality.
- `backend/channels.py` supports external communication and publishing integrations.
- `backend/extras.py`, `backend/fallback.py`, and `backend/mailer.py` provide additional application workflows.
- `backend/seed.py` supports sample workspace data.
- `frontend/src/pages/` contains the main application screens.
- `frontend/src/ui.jsx` provides shared interface components.
- `frontend/src/api.js` handles frontend API communication.
- `frontend/src/styles.css` contains application styling and themes.
- `render.yaml` defines the project's Render deployment configuration.

## Running Locally

### Prerequisites

- Python installed.
- Node.js and npm installed.
- Git installed if you plan to clone the repository.

### 1. Get the project

```bash
git clone https://github.com/mehroofsaba/Bizcuits.git
cd Bizcuits
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Configure the values you need in `.env`, then start Flask:

```bash
python app.py
```

The API is expected to run at `http://localhost:5000` with the default local configuration.

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

The Vite development configuration is intended to proxy `/api` requests to the local backend. If you change the backend address or port, make sure the frontend configuration matches it.

### 4. Explore the workspace

Open the application and select **Try the sample workspace**, or create an account.

Sample data is intended to help you explore the interface. Review the application's configuration before using it with real business information.

## Deployed link - https://bizcuits.onrender.com

## Configuration

The backend reads configuration from environment variables. Use `backend/.env.example` as the reference for the available settings.

Common settings include:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Application signing and security configuration |
| `DATABASE_URL` | Optional PostgreSQL connection string; local SQLite is supported |
| `GEMMA_BACKEND` | Select the configured AI backend |
| `GEMMA_MODEL` | Choose the language model identifier |
| `GEMINI_API_KEY` | Authenticate hosted Google AI Studio inference |
| `OLLAMA_URL` | Address of the configured Ollama service |
| `AI_LIMIT_PER_HOUR` | Configure the AI request limit |
| `RESEND_API_KEY` | Configure email delivery through Resend |
| `MAIL_FROM` | Sender address for supported email workflows |
| `APP_URL` | Public application URL used in relevant links and redirects |
| `STRIPE_SECRET_KEY` | Configure Stripe billing |
| `STRIPE_PRICE_ID` | Identify the configured subscription price |
| `STRIPE_WEBHOOK_SECRET` | Verify supported Stripe webhook requests |
| `CRON_SECRET` | Protect the scheduled-work endpoint |

Not every variable is required for local development. Configure only the services you intend to use.

**Never commit real API keys, passwords, tokens, or production secrets to the repository.** Use environment variables or the hosting provider's secret-management settings for deployed environments.

## Testing

### Backend

```bash
cd backend
pytest
```

### Frontend

```bash
cd frontend
npm test
```

The repository includes automated tests for selected backend endpoints, additional backend workflows, frontend components, and API-related behavior.

Automated tests do not guarantee that every external integration works with live credentials or that every production deployment is configured correctly.

## Deployment

The repository includes a `render.yaml` configuration for deployment through Render.

Before deploying, review the service definitions, build and start commands, environment variables, database configuration, and frontend-to-backend API URL. Production deployments should use a persistent database, keep secrets out of source control, and configure cross-origin access and authentication appropriately.

See the deployment configuration in [`render.yaml`](render.yaml) and the environment-variable reference in [`backend/.env.example`](backend/.env.example).

## Known Limitations & Future Work

The following features are not yet built or fully verified:

- Instagram and X publishing.
- Offline translation.
- WhatsApp message templates.
- Payment tracking for a business's own customer orders; the existing billing functionality concerns Bizcuits subscriptions.
- Automated tests against a live PostgreSQL database.
- Live end-to-end verification of all third-party integrations.

Feature availability may also depend on the external platform's API access, account permissions, and review requirements.

## Data & Privacy Notes

Bizcuits is designed around per-user data separation, optional public sharing, and user-controlled account data management. However, security depends on the complete deployment and configuration, not only the application code.

Before using Bizcuits for sensitive or real customer information, review the authentication setup, database access controls, secret management, backups, logging, third-party data processing, and applicable privacy obligations.

## Contributing

Contributions, bug reports, and thoughtful feature suggestions are welcome. Please review [`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting changes.

## License

See [`LICENSE`](LICENSE) for the project's license terms.
