# PROOFTRAIL AI

**Evidence-first web investigation platform.** PROOFTRAIL AI decomposes online claims into independently verifiable fields, discovers public sources with TinyFish Search, retrieves page content with TinyFish Fetch, and produces an auditable report with exact source passages, conflicts, gaps and uncertainty.

**Team Flux:** Vaishnavi Tamgale · Mahe Noor · Rahul Kumar

---

## Complete Project Documentation

| Document | Description |
|---|---|
| **[Interactive Swagger UI Docs](docs/SWAGGER_GUIDE.md)** | Guide to interactive OpenAPI 3.0 testing at `http://localhost:8000/docs` |
| **[REST API Specification](docs/API_DOCUMENTATION.md)** | Complete endpoints, request/response schemas, and curl examples |
| **[System Architecture](docs/ARCHITECTURE.md)** | Architectural design, component interaction, and SQLite schema |
| **[Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** | Docker Compose, Nginx, systemd, and production setup |
| **[Developer & Contributor Guide](docs/DEVELOPER_GUIDE.md)** | Local development workflows, testing, and coding standards |
| **[Real-Data Policy](docs/REAL_DATA_POLICY.md)** | Zero-mock rules, verbatim passage extraction, and truth taxonomy |
| **[TinyFish Setup Guide](docs/TINYFISH_SETUP.md)** | Environment variables, authentication, and endpoint defaults |
| **[Prompt 5 Compliance Report](docs/PROMPT_5_COMPLIANCE_REPORT.md)** | Master compliance audit certifying completion of all requirements |
| **[Security Audit & Penetration Test](security/PENETRATION_TEST_REPORT.md)** | Full penetration testing methodology, findings, and verification |
| **[Applied Security Fixes](security/FIXES_APPLIED.md)** | Comprehensive record of all vulnerability mitigations |

---

## What is implemented

- **Premium SaaS Frontend**: Multi-page intelligence dashboard built with React + Vite, inspired by Linear, Stripe, and Vercel.
- **FastAPI & Node Backend Engines**: Complete REST API for claim submission, investigation management, report retrieval, history, export, and retry.
- **Interactive Swagger UI**: Interactive OpenAPI 3.0 documentation served at `http://localhost:8000/docs` with "Try it out" test executions.
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
Investigation Engine (Port 8000) -------- SQLite audit ledger
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

- Node.js 20+ (or Python 3.11+)
- TinyFish API key for live web search and fetch
- Optional OpenAI-compatible API key for AI claim decomposition and evidence comparison
- Docker Engine + Docker Compose (optional deployment path)

## Run Locally

### 1. Backend

From the repository root:

```bash
# Configure environment credentials
cp backend/.env.example backend/.env
# Edit backend/.env and supply TINYFISH_API_KEY

# Start backend engine:
node backend/server.mjs
# Or with Python:
uvicorn backend.main:app --reload --port 8000
```

Access Swagger UI: **http://localhost:8000/docs**

### 2. Frontend (in a separate terminal)

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the local investigation engine. Health check: http://localhost:5173/api/health.

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/docs` | `GET` | Interactive Swagger UI API documentation |
| `/openapi.json` | `GET` | OpenAPI 3.0.3 machine schema |
| `/api/health` | `GET` | System status, provider configuration booleans, and cache metrics |
| `/api/investigations` | `POST` | Create and execute a live web investigation |
| `/api/investigations` | `GET` | List investigation history from the SQLite ledger |
| `/api/investigations/{id}` | `GET` | Get full audit report JSON |
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
# Frontend component & build verification
npm test --prefix frontend
npm run build --prefix frontend

# Backend unit & contract tests (Python)
python -m unittest discover -s backend -p "test_*.py"
```

## License

MIT — see [LICENSE](LICENSE).
