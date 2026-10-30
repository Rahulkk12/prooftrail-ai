# PROOFTRAIL AI

**Evidence-first web investigation platform.** PROOFTRAIL AI decomposes online claims into independently verifiable fields, discovers public sources with TinyFish Search, retrieves page content with TinyFish Fetch, and produces an auditable report with exact source passages, conflicts, gaps and uncertainty.

**Team Flux:** Vaishnavi Tamgale · Mahe Noor · Rahul Kumar

## What is implemented

- **Premium SaaS Frontend**: Multi-page intelligence dashboard built with React + Vite, inspired by Linear, Stripe, and Vercel.
- **FastAPI Backend**: Complete REST API for claim submission, investigation management, report retrieval, history, export, and retry.
- **SQLite Persistence**: Stores original claims, atomic fields, queries, sources, verbatim evidence, limitations, and full report ledgers.
- **TinyFish Search Integration**: Per-field official and independent query discovery with rate-limit backoff (HTTP 429), bounded concurrency, and URL deduplication.
- **TinyFish Fetch Integration**: Clean markdown DOM extraction with in-memory TTL caching, bounded batches, and per-URL error capture.
- **TinyFish Agent Integration**: Headless browser automation interface for dynamic navigation.
- **Atomic Claim Decomposition**: Hybrid decomposition using OpenAI-compatible LLMs with a deterministic rule-based fallback.
- **Four Forensic Statuses**: `SUPPORTED`, `CONTRADICTED`, `MIXED`, and `UNVERIFIED`.
- **Exact Verbatim Substring Validation**: The report strictly stores and verifies original source substrings; paraphrases and hallucinations are discarded.
- **Safe-by-Default Guardrails**: Missing evidence, missing keys, or malformed outputs cannot fabricate verdicts; fields remain `UNVERIFIED`.
- **Anti-SSRF Security**: Rejects localhost, RFC-1918 private subnets, cloud metadata endpoints (`169.254.169.254`), and credentials in URLs.
- **Docker Compose Deployment**: Production-ready deployment with Nginx same-origin proxy, security headers, and health checks.

## Architecture

```text
Browser (React/Vite)
       | same-origin /api
       v
Nginx reverse proxy (Docker deployment)
       |
       v
FastAPI orchestrator -------- SQLite audit ledger
       |
       +---- TinyFish Search (GET) -> candidate source URLs
       |
       +---- TinyFish Fetch (POST) -> retrieved page markdown & metadata
       |
       +---- TinyFish Agent (POST) -> interactive browser navigation
       |
       +---- Optional LLM -> atomic claim decomposition + evidence comparison
       |
       v
Validated verbatim passages + field findings -> report JSON / Markdown -> UI
```

## Requirements

- Python 3.11+
- Node.js 20+
- TinyFish API key for live web search and fetch
- Optional OpenAI-compatible API key for AI claim decomposition and evidence comparison
- Docker Engine + Docker Compose (optional deployment path)

## Run locally

### 1. Backend

From the repository root:

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` inside `backend/`, then configure credentials:

```env
TINYFISH_API_KEY=your_tinyfish_api_key
LLM_API_KEY=your_openai_compatible_api_key
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4.1-mini
DATABASE_PATH=./data/prooftrail.db
FRONTEND_ORIGIN=http://localhost:5173
MAX_SEARCH_RESULTS=8
MAX_FETCH_URLS=8
FETCH_TTL_SECONDS=0
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend (in a separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the local FastAPI service. Health check: http://localhost:5173/api/health.

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | System status, provider configuration booleans, and cache metrics |
| `/api/investigations` | `POST` | Create and execute an investigation |
| `/api/investigations` | `GET` | List investigation history with pagination and status filters |
| `/api/investigations/{id}` | `GET` | Get metadata summary for an investigation |
| `/api/investigations/{id}/report` | `GET` | Get full audit report JSON |
| `/api/investigations/{id}/export` | `GET` | Export report as `json` or `markdown` |
| `/api/investigations/{id}/retry` | `POST` | Start a new auditable run linked to the original investigation |

## Finding Policy

- **SUPPORTED** — Direct supporting passage(s) have been validated, with no direct contradictory passage in the validated evidence.
- **CONTRADICTED** — Direct contradictory passage(s) have been validated, with no direct supporting passage in the validated evidence.
- **MIXED** — Validated evidence contains both direct support and direct contradiction.
- **UNVERIFIED** — Evidence is missing, inaccessible, weak, malformed or not validated.

Every displayed quotation must be located character-for-character in retrieved page text.

## Automated Testing

```bash
# Backend unit & contract tests (mocked providers)
python -m unittest discover -s backend -p "test_*.py"

# Frontend component & build verification
npm test --prefix frontend
npm run build --prefix frontend
```

## License

MIT — see [LICENSE](LICENSE).
