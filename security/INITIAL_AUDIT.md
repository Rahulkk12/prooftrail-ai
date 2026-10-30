# PROOFTRAIL AI — Initial Technical & Security Audit Report

**Date:** 2026-10-30  
**Auditor:** Senior Application Security & Quality Engineering Assessment  
**Repository:** `https://github.com/Rahulkk12/prooftrail-ai`  
**Branch Inspected:** `main`  
**Commit:** `c89125f`

---

## 1. Executive Summary

This initial audit establishes the technical baseline of ProofTrail AI before refactoring, hardening, and real-data enforcement. 

ProofTrail AI is designed as a web-evidence fact investigation platform powered by the TinyFish Search and Fetch APIs. While previous development established a responsive React frontend, a FastAPI backend, anti-SSRF protections, and a 4-status evaluation schema (`SUPPORTED`, `CONTRADICTED`, `MIXED`, `UNVERIFIED`), several architectural flaws, placeholder flows, and security gaps were confirmed that prevent the application from being considered production-ready.

---

## 2. Existing Architecture & User Workflow

```
[User Browser]
      │
      ▼
[React 18 + Vite SPA] (Port 5173 / Nginx 8080)
      │
      ▼ (HTTP /api proxy)
[FastAPI Backend] (Port 8000)
      │
      ├─► [Rate Limiter & Input Validator]
      ├─► [Claim Decomposition Engine] (Rule-based regex / Optional LLM)
      ├─► [TinyFish Search Adapter] (Discovers real URLs)
      ├─► [Anti-SSRF Validator] (Filters internal/cloud metadata IPs)
      ├─► [TinyFish Fetch Adapter] (Retrieves page content)
      ├─► [Verbatim Substring Extractor] (Exact matching against source text)
      ├─► [Evidence Assessor] (Assigns SUPPORTED/CONTRADICTED/MIXED/UNVERIFIED)
      └─► [SQLite Persistence] (Stores investigations, queries, and limitations)
```

---

## 3. Working Functionality (Verified Directly)

1. **Frontend Interface & Responsive Layout**:
   - 6 functional pages: Landing, Dashboard, New Investigation, Progress Tracker, Report View, and Audit History.
   - Dark theme styling responsive across desktop (1440px), tablet (768px), and mobile (480px).
   - Component test suite (`frontend/test-frontend.js`) passes 46/46 assertions.
   - Production bundle builds cleanly via Vite (`dist/index.html` + assets).
2. **Anti-SSRF Protections (Partial)**:
   - `validate_public_url()` checks URL scheme (`http://` and `https://` only).
   - Rejects loopback addresses (`127.0.0.1`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and AWS/GCP link-local metadata addresses (`169.254.169.254`).
   - Revalidates HTTP redirect targets (`final_url`).
3. **Verbatim Passage Extraction**:
   - `extract_exact_passage()` enforces that evidence citations must be exact case-insensitive substrings of retrieved page text. Paraphrased or hallucinated quotes cannot be attributed to a source.
4. **Rate Limiting**:
   - `SlidingWindowRateLimiter` enforces a 30 req/min threshold per IP and returns HTTP 429 with a standard `Retry-After` header.
5. **Security Headers**:
   - Middleware sets `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 4. Features That Do Not Work / Deficiencies Identified

1. **Silent Tolerance of Missing TinyFish Credentials (Real-Data Violation)**:
   - When `TINYFISH_API_KEY` was missing, the backend pipeline logged a limitation but still completed the investigation with status `completed_with_gaps` and empty sources.
   - In the frontend, users clicking fallback links on the Dashboard or History page could load static benchmark demonstration records (`inv_demo_...`) that simulate real findings.
   - **Remediation**: Remove benchmark demo fallbacks from live customer workflows. If `TINYFISH_API_KEY` is missing or the external service fails, the API must fail explicitly with HTTP 503 or an explicit failure status explaining that real web research requires valid credentials.
2. **Monolithic Backend Client**:
   - TinyFish Search, Fetch, and Agent integration code was directly embedded in `backend/main.py` rather than a modular integration class.
   - Configuration was loaded via loose `os.getenv` calls without centralized schema validation.
   - **Remediation**: Create `backend/app/config.py` and `backend/app/integrations/tinyfish_client.py`.
3. **No Authentication or Investigation Ownership**:
   - All investigation IDs (`inv_...`) are unauthenticated. Any user who guesses or discovers an ID can retrieve, export, or retry an investigation.
   - **Remediation**: Document access control limitations and implement tenant/session separation.
4. **Time-of-Check to Time-of-Use (TOCTOU) DNS Rebinding**:
   - The DNS resolution check in `is_safe_public_url()` resolves the host IP at time $t_0$, but `httpx` performs its own DNS resolution at time $t_1$. An attacker could configure a DNS server to return a public IP first and a local IP (`127.0.0.1`) on the second lookup.
   - **Remediation**: Pin resolved IP address during connection or enforce IP-level socket binding where supported.

---

## 5. Security Controls Analysis

| Control Area | Current Implementation Status | Gap / Vulnerability |
|---|---|---|
| **Authentication** | None | Endpoints are completely open. No user accounts or API tokens. |
| **Authorization** | None | Insecure Direct Object References (IDOR) on `/api/investigations/{id}`. |
| **SQL Injection** | Parameterized queries via SQLite | Low risk; all database writes use `?` placeholders. |
| **SSRF** | Scheme, IP range, and redirect checking | Vulnerable to DNS rebinding (TOCTOU) and IPv6 loopback variants. |
| **Prompt Injection** | Delimiter fencing (`<UNTRUSTED_RETRIEVED_WEB_DATA>`) | Model instructions could still be influenced if LLM temperature is high or schema validation fails. |
| **Input Validation** | Pydantic length bounds (12–2000 chars) | Functional, but does not sanitize potential control characters. |
| **Secret Management** | `.gitignore` covers `.env` | Safe locally, but no secret-redaction filter in backend log stream. |
| **CORS** | Configurable `FRONTEND_ORIGIN` | Safe when configured, but defaults to wildcard if origin is missing. |

---

## 6. TinyFish Integration Baseline

- **Current Status**: **BLOCKED — Credentials Not Configured on Host**.
- **Implementation State**: Code exists to call `api.search.tinyfish.ai` and `api.fetch.tinyfish.ai`, but requires refactoring into a clean standalone module `backend/app/integrations/tinyfish_client.py`.
- **Live Search/Fetch Verification**: Cannot be verified live until a valid `TINYFISH_API_KEY` is provided in `backend/.env`.

---

## 7. Critical Remediation Priorities

1. **Architecture Modularization**:
   - Extract configuration into `backend/app/config.py`.
   - Implement dedicated `backend/app/integrations/tinyfish_client.py`.
2. **Real-Data Policy Enforcement**:
   - Eliminate hardcoded demo reports from user investigation flows.
   - Return explicit error states when TinyFish credentials are absent or fail.
3. **SSRF Hardening**:
   - Add DNS rebinding protections and IPv6 edge-case defenses.
4. **Prompt Injection & Evidence Integrity**:
   - Enforce server-side schema verification on LLM outputs and reject any evidence that cannot be matched to a verbatim source substring.
5. **Documentation & Tests**:
   - Provide comprehensive documentation in `security/` and `docs/`.
