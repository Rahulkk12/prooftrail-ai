# PROOFTRAIL AI

**Evidence-first web investigation.** PROOFTRAIL AI decomposes online claims into independently verifiable fields, discovers public sources with TinyFish Search, retrieves page content with TinyFish Fetch, and produces an auditable report with exact source passages, conflicts, gaps and uncertainty.

**Team Flux:** Vaishnavi Tamgale · Mahe Noor · Rahul Kumar

## What is implemented

- React + Vite responsive investigation interface.
- FastAPI API for claim submission, report retrieval, health and retry.
- SQLite persistence for investigation metadata and report snapshots.
- TinyFish Search REST integration with per-field query discovery and URL deduplication.
- TinyFish Fetch REST integration with bounded batches, freshness preference and per-URL error capture.
- Optional OpenAI-compatible LLM adapter for atomic claim decomposition and evidence comparison.
- Four statuses: SUPPORTED, CONTRADICTED, MIXED and UNVERIFIED.
- Exact source-passage validation; the report stores the original source substring, not a model-retyped quote.
- Deterministic status guardrails: a supported/contradicted verdict must agree with the validated evidence relation; both direct relations force MIXED.
- Safe-by-default behavior: missing evidence, missing LLM configuration or malformed model output cannot produce a confident verdict.
- Baseline URL validation, server-side secrets, bounded source counts/timeouts and CI.
- Docker Compose deployment with an Nginx same-origin API proxy and security headers.

## Architecture

```text
Browser (React/Vite)
       | same-origin /api
       v
Nginx reverse proxy (Docker deployment)
       |
       v
FastAPI orchestrator -------- SQLite report store
       |
       +---- TinyFish Search (GET) -> candidate source URLs
       |
       +---- TinyFish Fetch (POST) -> retrieved page text/metadata
       |
       +---- Optional LLM -> atomic claims + evidence relations
       |
       v
Validated source passages + field findings -> report JSON -> UI
```

TinyFish Search and Fetch are used for web discovery and retrieval. PROOFTRAIL owns claim decomposition, evidence linkage, status policy and report presentation. Provider credentials remain in the backend environment; never expose them through Vite variables.

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
.venv\\Scripts\\Activate.ps1
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

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the local FastAPI service. Health check: http://localhost:5173/api/health.

## Run with Docker Compose

1. Create `backend/.env` from `backend/.env.example` and add your TinyFish key (and optional LLM key).
2. From the repository root:

```bash
docker compose up --build
```

3. Open http://localhost:8080.
4. Stop with `docker compose down`. Add `-v` only if you intentionally want to delete the persisted SQLite data volume.

The frontend container serves the built app through Nginx and proxies `/api` to the backend service. The backend runs as a non-root user. The database is stored in a named Docker volume.

## Environment variables

Backend `.env`:

| Variable | Purpose |
|---|---|
| `TINYFISH_API_KEY` | Required for live TinyFish Search and Fetch |
| `LLM_API_KEY` | Optional key for an OpenAI-compatible chat completions endpoint |
| `LLM_BASE_URL` | Provider API base URL, default OpenRouter |
| `LLM_MODEL` | Model identifier accepted by the provider |
| `DATABASE_PATH` | SQLite database path |
| `FRONTEND_ORIGIN` | Development CORS origin |
| `MAX_SEARCH_RESULTS` | Candidate cap, maximum 10 |
| `MAX_FETCH_URLS` | Fetch batch cap, maximum 10 |
| `FETCH_TTL_SECONDS` | Fetch cache freshness preference; 0 requests live freshness |

Do not put provider secrets in frontend environment variables, commit real `.env` files, or paste keys into issue reports.

## API

- `GET /api/health` — readiness and boolean provider configuration indicators; no credentials returned.
- `POST /api/investigations` — create an investigation. Body: `{"claim":"...","source_url":null}`.
- `GET /api/investigations/{id}` — investigation metadata.
- `GET /api/investigations/{id}/report` — stored report snapshot.
- `POST /api/investigations/{id}/retry` — start a new auditable run from the original inputs; prior reports are preserved.

## Finding policy

- **SUPPORTED** — direct supporting passage(s) have been validated, with no direct contradictory passage in the validated evidence.
- **CONTRADICTED** — direct contradictory passage(s) have been validated, with no direct supporting passage in the validated evidence.
- **MIXED** — validated evidence contains both direct support and direct contradiction.
- **UNVERIFIED** — evidence is missing, inaccessible, weak, malformed or not validated.

No evidence does not mean false. A model-generated explanation is not itself evidence. Every displayed quotation must be located in retrieved page text and the original source substring is stored. Source credibility, freshness and context still require human scrutiny.

## Security and limitations

- Provider keys remain server-side.
- User-supplied URLs must use HTTP(S), cannot contain credentials, and are rejected when the hostname resolves to non-public IP addresses.
- Search/fetch counts, input lengths and request timeouts are bounded.
- Retrieved pages are treated as untrusted data; instructions inside them must not be followed by the analysis model.
- This URL validation is a baseline, not a complete production SSRF boundary. For public deployment, add network-level egress restrictions, redirect target revalidation, DNS-rebinding protections, authentication, rate limiting and abuse monitoring.
- The app currently uses synchronous request/response orchestration and SQLite. It is a hackathon MVP, not a horizontally scaled production service.
- If the LLM key is absent or its output is invalid, findings stay UNVERIFIED. This preserves uncertainty but does not provide AI assessment.
- Accuracy, latency and cost metrics have not been claimed. Measure against a human-reviewed gold set before making performance claims.

## Validation

CI runs:
- Python unittest suite: URL validation, evidence relation/status policy, verbatim passage matching, API health, request validation, report retrieval and a mocked provider flow including retry.
- Frontend production build with Vite.

CI does not prove that your TinyFish account credentials work. Before a live demo, configure the keys and run an end-to-end investigation. Inspect the source pages and exact passages manually.

## TinyFish REST contract

The adapter follows the official REST references:
- Search: `GET https://api.search.tinyfish.ai`, query parameters including `query`, `purpose`, `location` and `language`; authentication via `X-API-Key`.
- Fetch: `POST https://api.fetch.tinyfish.ai`, JSON body with `urls`, optional `format` and `ttl`; response includes `results[]` and per-URL `errors[]`; authentication via `X-API-Key`.

Provider schemas and account quotas can change; check the official docs and account dashboard before a production deployment.

## Project structure

```text
backend/
  main.py
  test_main.py
  requirements.txt
  Dockerfile
  .env.example
frontend/
  src/main.jsx
  src/styles.css
  Dockerfile
  nginx.conf
docs/
  TEST_PLAN.md
.github/workflows/ci.yml
docker-compose.yml
```

## License

MIT — see [LICENSE](LICENSE).
