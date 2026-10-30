# TinyFish Integration Setup Guide

This guide walks you through connecting ProofTrail AI to the live TinyFish Search and Fetch APIs.

---

## 1. Obtain Your TinyFish API Key

1. Visit [https://tinyfish.ai](https://tinyfish.ai) and sign in or create an account.
2. Navigate to your Developer Dashboard or API Keys section.
3. Generate and copy your secret API key (typically starts with `tf_...`).

---

## 2. Configure Your Local Environment

Create or edit the local environment file:

📁 **`backend/.env`**

Add your API key:

```env
# Required for live web research
TINYFISH_API_KEY=your_actual_tinyfish_api_key_here

# Official Default Endpoints (pre-configured; no change needed)
TINYFISH_SEARCH_URL=https://api.search.tinyfish.ai
TINYFISH_FETCH_URL=https://api.fetch.tinyfish.ai
TINYFISH_AGENT_URL=https://agent.tinyfish.ai

# Optional LLM for deep semantic reasoning (e.g. OpenRouter or OpenAI)
LLM_API_KEY=
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4.1-mini

# Database and App Configuration
DATABASE_URL=sqlite:///./data/prooftrail.db
ENVIRONMENT=development
FRONTEND_ORIGIN=http://localhost:5173
```

> [!IMPORTANT]
> Never commit `backend/.env` to Git. The repository's `.gitignore` automatically prevents `.env` from being tracked.

---

## 3. Verify Connection

Start the backend server and probe the health endpoint:

```bash
curl http://localhost:8000/api/health
```

Expected JSON response:

```json
{
  "status": "ok",
  "version": "0.4.0",
  "tinyfish_configured": true,
  "llm_configured": false,
  "database": "sqlite",
  "policy": "real_data_only"
}
```

If `"tinyfish_configured": true` is returned, your API key has been detected and ProofTrail is ready to conduct live web investigations.

---

## 4. Run an Investigation

1. Open the frontend: **[http://localhost:5173/](http://localhost:5173/)**
2. Click **Start New Investigation** in the top navigation or sidebar.
3. Enter any verifiable public claim (minimum 12 characters). For example:
   > *"The Government of India is offering a ₹50,000 scholarship to college students before 30 November."*
4. Optionally provide an official reference URL.
5. Click **Investigate Claim**.

### What Happens Behind the Scenes:
1. ProofTrail decomposes the claim into atomic verifiable components (organization, amount, eligibility, deadline).
2. `TinyFish Search` queries `api.search.tinyfish.ai` to discover authoritative web sources.
3. `TinyFish Fetch` retrieves raw markdown text from `api.fetch.tinyfish.ai`.
4. The evidence engine extracts verbatim substring quotations from the retrieved text.
5. The claim is assigned one of the four truth statuses: `SUPPORTED`, `CONTRADICTED`, `MIXED`, or `UNVERIFIED`.

---

## 5. Troubleshooting & Error Codes

| Symptom | Cause | Solution |
|---|---|---|
| **HTTP 503 Service Unavailable** | `TINYFISH_API_KEY` is empty or missing from `backend/.env`. | Open `backend/.env` and paste your TinyFish key, then restart the backend. |
| **HTTP 401 Unauthorized** | The provided API key is invalid or expired. | Double check your key in the TinyFish developer dashboard. |
| **HTTP 429 Rate Limit Exceeded** | TinyFish API query quota reached. | ProofTrail automatically applies exponential backoff. Wait a few moments before launching another inquiry. |
| **Status `UNVERIFIED` on All Fields** | TinyFish Search found no matching public web pages for the query. | Try rephrasing the claim with more specific entity names, dates, or organization titles. |
