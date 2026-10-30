# PROOFTRAIL AI — Validation & Verification Plan

## 1. Automated CI Coverage

The CI workflow installs backend dependencies, runs Python unit and integration tests (using mocked provider responses), installs frontend dependencies, builds the Vite production bundle, and executes the frontend verification test suite.

### Backend Automated Test Suites (`backend/test_main.py`):
1. **URL Validation & Anti-SSRF Defense**:
   - Accepts valid public HTTP/HTTPS URLs and global public IPs.
   - Strictly rejects localhost, loopback (`127.0.0.1`), RFC-1918 private subnets (`10.x`, `172.16-31.x`, `192.168.x`).
   - Rejects link-local cloud metadata endpoints (`169.254.169.254`).
   - Rejects non-HTTP schemes (e.g. `file://`, `ftp://`) and embedded credentials (`https://user:pass@host`).
2. **Evidence Status Policy & Verbatim Extraction**:
   - `SUPPORTED`: Requires supporting passage and no contradictory passages.
   - `CONTRADICTED`: Requires contradicting passage and no supporting passages.
   - `MIXED`: Enforces that both supporting and contradicting evidence are present.
   - `UNVERIFIED`: Assigned whenever evidence is missing, inaccessible, or model verdict is unsupported.
   - Substring Extraction: Extracts exact original source slice allowing only whitespace normalization; strictly rejects paraphrased passages.
3. **Claim Decomposition**:
   - Rule-based deterministic fallback parses funding/stipend amounts, deadlines, and organizations into atomic claim units.
   - Automatically attaches targeted `official_query` and `independent_query` for web discovery.
4. **TinyFish Adapter Mocked Unit Tests**:
   - Schema normalization for Search results (`position`, `site_name`, `title`, `snippet`, `url`).
   - Bounded retries and backoff on HTTP 429 (Rate Limit).
   - In-memory content caching prevents redundant HTTP fetch calls on identical URLs.
   - Partial page errors captured in `errors[]` array.
5. **API Contracts & Integration**:
   - `GET /api/health`: Confirms status and cache size without exposing credentials.
   - `POST /api/investigations`: Executes end-to-end pipeline with mocked providers.
   - `GET /api/investigations`: Returns paginated history and findings breakdown.
   - `GET /api/investigations/{id}`: Returns investigation metadata.
   - `GET /api/investigations/{id}/report`: Returns full report JSON.
   - `GET /api/investigations/{id}/export`: Exports report in structured JSON or executive Markdown format.
   - `POST /api/investigations/{id}/retry`: Preserves prior audit run and links `retry_of`.

---

## 2. Live Provider Acceptance Testing

Live tests interact with real external APIs (`api.search.tinyfish.ai`, `api.fetch.tinyfish.ai`, and OpenAI-compatible LLMs). They are clearly distinguished from unit tests and require explicit environment activation.

### To Run Live TinyFish Integration Tests:
```bash
export TINYFISH_API_KEY="your-real-tinyfish-api-key"
export RUN_LIVE_TINYFISH_TESTS=1
python -m unittest backend.test_main.LiveTinyFishIntegrationTests
```

### Manual Acceptance Checklist:
1. Configure `TINYFISH_API_KEY` in `backend/.env`.
2. Configure `LLM_API_KEY` in `backend/.env` (optional, for AI comparison).
3. Check `GET /api/health` and verify `tinyfish_configured: true`.
4. Submit a test claim via `POST /api/investigations`:
   - *"The Government announced a ₹50,000 scholarship for college students before 30 November."*
5. Inspect the report run trace:
   - Verify `tinyfish_search` queries discovered real government/news candidate URLs.
   - Verify `tinyfish_fetch` retrieved clean markdown DOM text.
   - Verify every cited evidence passage matches word-for-word in the source DOM.
6. Submit a conflicting claim and verify that contradicting and supporting passages trigger `MIXED`.
7. Submit an unverified or obscure claim and verify status remains strictly `UNVERIFIED`.
