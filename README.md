# PROOFTRAIL AI

Evidence-first web investigation. PROOFTRAIL AI breaks online claims into verifiable fields, discovers and retrieves web sources with TinyFish, and produces a transparent report with source-linked evidence, contradictions, gaps and uncertainty.

Team Flux · Vaishnavi Tamgale · Mahe Noor · Rahul Kumar

## MVP baseline

This branch adds a React + Vite frontend, FastAPI backend, SQLite report persistence, TinyFish Search/Fetch adapter, optional OpenAI-compatible LLM adapter, field-level findings, exact-passage checks, health and report endpoints, and basic URL validation. This is a starting implementation, not a claim that a live provider run or build test has passed.

## Architecture

React/Vite → FastAPI orchestrator → TinyFish Search → candidate URLs → TinyFish Fetch → page text and metadata → optional LLM → claims and evidence comparison → SQLite → report JSON → UI.

The browser never receives provider credentials. TinyFish supplies observations; PROOFTRAIL owns the evidence model and report policy. If no LLM key is configured, findings remain UNVERIFIED rather than inventing a verdict.

## Requirements

- Python 3.11+
- Node.js 20+
- TinyFish API key for live Search/Fetch
- Optional OpenAI-compatible API key for decomposition and evidence assessment

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Copy .env.example to .env and edit provider keys
uvicorn main:app --reload --port 8000
```

### Frontend (new terminal)

```bash
cd frontend
npm install
# Copy .env.example to .env
npm run dev
```

Open http://localhost:5173. API health: http://localhost:8000/api/health.

## Environment

Backend .env: TINYFISH_API_KEY, optional LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, DATABASE_PATH, MAX_SEARCH_RESULTS, MAX_FETCH_URLS. Frontend .env: VITE_API_BASE_URL. Never put secrets in Vite variables or commit real .env files.

## API

- GET /api/health
- POST /api/investigations with body {"claim":"...","source_url":null}
- GET /api/investigations/{id}
- GET /api/investigations/{id}/report
- POST /api/investigations/{id}/retry reserved; currently returns 501

## Finding policy

- SUPPORTED — direct support in credible retrieved evidence, with no material unresolved contradiction.
- CONTRADICTED — direct credible evidence conflicts with the claim field.
- MIXED — material evidence supports and conflicts.
- UNVERIFIED — evidence is missing, inaccessible, weak, stale or not validated.

No evidence does not mean false. A model-generated explanation is not itself evidence. Only validated passages from retrieved pages are attached to findings.

## Security and known limitations

Credentials stay server-side. URL input is restricted to HTTP(S), rejects embedded credentials, local/private/reserved IPs and non-public DNS results. Provider content is treated as untrusted data. Candidate counts and request timeouts are bounded. This is not a production-grade SSRF boundary: add egress network controls and robust redirect/DNS-rebinding protections before public deployment. TinyFish REST payload fields in the initial adapter are provisional and must be confirmed against current official REST docs/account before live use. Synchronous requests and SQLite are intended for a hackathon MVP, not high concurrency. No accuracy, latency or cost metrics are claimed before a human-reviewed evaluation.

## Next steps

1. Confirm TinyFish Search and Fetch REST schemas and normalize actual response shapes.
2. Add automated backend tests for statuses, evidence provenance, URL validation, provider failures and prompt injection.
3. Add UI tests for loading, empty, partial and failure states.
4. Add background jobs/rate limiting/authentication before public multi-user deployment.
5. Create a human-reviewed gold set and report measured performance.

Add the license selected by project owners before public distribution.
