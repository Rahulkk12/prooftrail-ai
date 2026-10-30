# PROOFTRAIL AI — Validation, Security Hardening & Verification Plan

## 1. Automated CI Coverage

The CI workflow installs backend dependencies, runs Python unit and security integration tests (using mocked provider responses), installs frontend dependencies, builds the Vite production bundle, and executes the frontend verification test suite.

### Backend Automated Test Suites (`backend/test_main.py`):
1. **URL Validation & Anti-SSRF Defense**:
   - Accepts valid public HTTP/HTTPS URLs and global public IPs.
   - Strictly rejects localhost, loopback (`127.0.0.1`), RFC-1918 private subnets (`10.x`, `172.16-31.x`, `192.168.x`).
   - Rejects link-local cloud metadata endpoints (`169.254.169.254`).
   - Rejects IPv4-mapped IPv6 private addresses (e.g. `::ffff:127.0.0.1`, `::ffff:169.254.169.254`).
   - Rejects non-HTTP schemes (e.g. `file://`, `ftp://`, `gopher://`, `javascript:`) and embedded credentials (`https://user:pass@host`).
   - Redirect Revalidation: Re-checks DNS resolution and IP ranges on the destination `final_url` returned after web redirects.
2. **Prompt Injection & Adversarial Content Defense**:
   - Sanitizes untrusted webpage text, disarming XML/HTML delimiter tags (e.g., `<UNTRUSTED_RETRIEVED_WEB_DATA>`).
   - Strips zero-width unicode characters and control characters used for prompt smuggling.
   - Strictly fences retrieved web text within structured XML data blocks with system-level instruction overrides disarmed.
3. **Evidence Status Policy & Verbatim Extraction**:
   - `SUPPORTED`: Requires supporting passage and zero contradictory passages.
   - `CONTRADICTED`: Requires contradictory passage and zero supporting passages.
   - `MIXED`: Enforces that both supporting and contradicting evidence are present.
   - `UNVERIFIED`: Assigned whenever evidence is missing, inaccessible, or model verdict is unsupported. Missing evidence is never interpreted as proof of falsity.
   - Substring Extraction: Extracts exact original source slice allowing only whitespace normalization; strictly rejects paraphrased passages.
4. **Claim Decomposition**:
   - Rule-based deterministic fallback parses funding/stipend amounts, deadlines, organizations, and eligibility into atomic claim units.
   - Automatically attaches targeted `official_query` and `independent_query` for web discovery.
5. **Source Quality & Credibility Evaluation**:
   - Classifies sources by domain credibility (`OFFICIAL_PORTAL`, `REPUTABLE_NEWS`, `SECONDARY_OR_COMMUNITY`, `GENERAL_WEB`).
   - Evaluates publication dates to flag potentially outdated historical articles.
6. **Security Hardening & Secret Protection**:
   - Security headers verified on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'self'`, `Permissions-Policy`.
   - Rate limiting enforced with sliding window per IP.
   - Sanitizes logs and health endpoints: keys and tokens are never exposed.
7. **TinyFish Adapter Unit Tests**:
   - Schema normalization for Search results (`position`, `site_name`, `title`, `snippet`, `url`).
   - Bounded retries and backoff on HTTP 429 (Rate Limit).
   - In-memory content caching prevents redundant HTTP fetch calls on identical URLs.
   - Partial page errors captured in `errors[]` array.

---

## 2. Live Provider Acceptance Testing

Live tests interact with real external APIs (`api.search.tinyfish.ai`, `api.fetch.tinyfish.ai`, and OpenAI-compatible LLMs). They are clearly distinguished from unit tests and require explicit environment activation.

### To Run Live TinyFish Integration Tests:
```bash
export TINYFISH_API_KEY="your-real-tinyfish-api-key"
export RUN_LIVE_TINYFISH_TESTS=1
python -m unittest backend.test_main.LiveTinyFishIntegrationTests
```

---

## 3. Known Limitations & Security Disclaimers

> [!WARNING]
> ProofTrail AI is designed as a forensic evidence-assistance system. It does not claim formal security certification or complete, infallible protection against all theoretical attacks.

Known boundaries and operational limitations:
1. **Network-Level DNS Rebinding**: Application-level DNS validation checks host resolution at request time. In high-security multi-tenant environments, dedicated OS/container network-level egress firewalls and proxy egress gateways should be configured.
2. **Dynamic Client-Side Single Page Apps**: Standard static fetch extracts rendered HTML/markdown. Sites requiring complex multi-step user interaction (e.g. CAPTCHAs or authenticated portals) require the TinyFish Agent interface.
3. **Syndicated Wire Reports**: If multiple news portals republish the exact same wire service bulletin (e.g. identical press release), ProofTrail evaluates unique root domains, but human review is still advised to distinguish independent reporting from syndicated press releases.
4. **Third-Party Model Integrity**: If an external LLM provider experiences an outage or provides unparseable output, the engine conservatively downgrades all claims to `UNVERIFIED` rather than guessing or hallucinating facts.
