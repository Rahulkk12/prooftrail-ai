# PROOFTRAIL AI — System Architecture & Design Specification

**Version:** 0.4.0  
**Status:** Production Ready  
**Engine:** Real-Time Web Evidence Investigation & Audit Ledger

---

## 1. High-Level Architecture Overview

PROOFTRAIL AI is designed from the ground up as an **evidence-first web investigation platform**. Unlike generic chat interfaces or hallucination-prone search wrappers, PROOFTRAIL AI enforces a strict **Real-Data Policy**: every claim is decomposed into verifiable atomic fields, audited against real web content retrieved live via TinyFish Search and Fetch, validated with high-precision verbatim substring extraction, and preserved in an immutable local SQLite audit ledger.

```
                              ┌────────────────────────────────────────┐
                              │            USER BROWSER                │
                              │    (React 18 + Vite / Swagger UI)      │
                              └──────────────────┬─────────────────────┘
                                                 │
                                                 │ HTTP / JSON / SSE
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │         NGINX / VITE PROXY             │
                              │   (Reverse Proxy & Security Headers)   │
                              └──────────────────┬─────────────────────┘
                                                 │
                                                 │ HTTP /api (Port 8000)
                                                 ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                PROOFTRAIL AI BACKEND ENGINE                                   │
│                                                                                               │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌─────────────────────────────┐    │
│  │ Rate Limiter &        │   │ Input Validation &    │   │ Atomic Claim Decomposition  │    │
│  │ Sliding Window Check  ├──►│ SSRF Guardrails       ├──►│ (LLM / Rule-Based Heuristic)│    │
│  └───────────────────────┘   └───────────────────────┘   └──────────────┬──────────────┘    │
│                                                                         │                   │
│                                                                         ▼                   │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌─────────────────────────────┐    │
│  │ Exact Verbatim        │   │ TinyFish Fetch        │   │ Multi-Tier TinyFish Search  │    │
│  │ Substring Extraction  │◄──┤ (Markdown DOM Parser) │◄──┤ (Official & News Expansion) │    │
│  └──────────┬────────────┘   └───────────────────────┘   └─────────────────────────────┘    │
│             │                                                                               │
│             ▼                                                                               │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌─────────────────────────────┐    │
│  │ 4-Status Forensic     │   │ Structured Report     │   │ SQLite Audit Ledger         │    │
│  │ Evidence Assessor     ├──►│ Builder & Formatter   ├──►│ (Persistent Local Storage)  │    │
│  └───────────────────────┘   └──────────┬────────────┘   └─────────────────────────────┘    │
└─────────────────────────────────────────┼─────────────────────────────────────────────────────┘
                                          │
                                          ▼
                              ┌────────────────────────────────────────┐
                              │         CLIENT PRESENTATION            │
                              │ • Verbatim Citations with Source Links │
                              │ • Status: SUPPORTED / CONTRADICTED     │
                              │ • Gaps, Conflicts & Audit Export       │
                              └────────────────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### A. Real-Data Enforcement (Zero-Mock Policy)
- **No Mock or Synthetic Evidence**: The backend refuses to generate artificial citations, fake publisher names, or synthetic confidence scores.
- **Fail-Closed Execution**: If `TINYFISH_API_KEY` is missing or the external crawler is unreachable, the system halts immediately with HTTP 503 and actionable diagnostic errors.
- **Exact Verbatim Substrings**: Citations must be authentic substrings of the retrieved web page markdown. Hallucinations or paraphrases are immediately rejected.

### B. Anti-SSRF Defense in Depth
PROOFTRAIL AI accepts user-supplied source URLs for deep target verification. To prevent Server-Side Request Forgery (SSRF), all target URLs pass through strict multi-stage validation:
1. **Scheme Validation**: Only `http:` and `https:` schemes are accepted.
2. **DNS Resolution & Subnet Prohibitions**: Client-supplied hostnames are resolved to IP addresses and checked against prohibited network ranges:
   - Loopback: `127.0.0.0/8`, `::1`
   - Private Networks (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Cloud Provider Metadata: `169.254.169.254`, `169.254.0.0/16`
   - Carrier-Grade NAT (RFC 6598): `100.64.0.0/10`
   - Documentation Ranges: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`
   - Link-Local IPv6: `fe80::/10`, Unique Local IPv6: `fc00::/7`
3. **Redirect Re-validation**: HTTP redirects (`301`, `302`, `307`, `308`) are traced and re-validated at each hop to eliminate open redirect bypasses.

### C. Four-Verdict Forensic Schema
Every investigated claim unit is assigned exactly one of four forensic truth statuses:
- **`SUPPORTED`**: Genuine retrieved source passages corroborate the primary factual assertion.
- **`CONTRADICTED`**: High-credibility sources explicitly refute, deny, or debunk the factual assertion.
- **`MIXED`**: Multiple conflicting evidence records exist across credible sources.
- **`UNVERIFIED`**: Insufficient or inconclusive public evidence was retrieved. **Missing evidence never automatically defaults to false.**

---

## 3. Data Storage & Schema Design

PROOFTRAIL AI uses an embedded SQLite database (`backend/data/prooftrail.db`) with WAL mode for fast, atomic, zero-setup persistence.

### Investigations Table
```sql
CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    input_text TEXT NOT NULL,
    input_url TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    claim_units_count INTEGER DEFAULT 0,
    sources_count INTEGER DEFAULT 0,
    findings_count INTEGER DEFAULT 0,
    search_queries_json TEXT,
    limitations_json TEXT,
    report_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON investigations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
```

---

## 4. Component Interaction Lifecycle

1. **User Submission**: The client dispatches `POST /api/investigations` with `{ "input_text": "...", "input_url": "..." }`.
2. **Decomposition**: The engine segments the input claim into 1–4 atomic verifiable claim units.
3. **Search Discovery**: The engine executes multi-tier search queries via TinyFish Search (`api.search.tinyfish.ai`), collecting official portals, reputable press outlets, and general web sources.
4. **Content Retrieval**: Candidate URLs are fetched in parallel batches via TinyFish Fetch (`api.fetch.tinyfish.ai`), converting dynamic DOM into clean markdown.
5. **Verbatim Matching**: The engine scans retrieved text for sentence-level semantic matches, verifying exact substring presence.
6. **Verdict Formulation**: Truth relations (`SUPPORTS`, `CONTRADICTS`, `CONTEXT`) are evaluated and combined into the final forensic report.
7. **Audit Record**: The full report is committed to SQLite and returned to the client for display in the interactive dashboard.
