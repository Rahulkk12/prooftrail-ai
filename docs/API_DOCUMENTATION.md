# PROOFTRAIL AI — REST API Documentation

**Specification Version:** OpenAPI 3.0.3  
**Base URL:** `http://localhost:8000`  
**Interactive UI:** `http://localhost:8000/docs`  
**Machine Schema:** `http://localhost:8000/openapi.json`

---

## Overview

The PROOFTRAIL AI API enables automated fact auditing, claim decomposition, live web crawling via TinyFish, exact verbatim passage verification, and persistent investigation ledger retrieval.

---

## Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/docs` | Interactive Swagger UI documentation with "Try it out" buttons |
| `GET` | `/openapi.json` | OpenAPI 3.0.3 JSON schema specification |
| `GET` | `/api/health` | Service health status, TinyFish configuration, and database state |
| `POST` | `/api/investigations` | Initiate a new live web evidence investigation |
| `GET` | `/api/investigations` | List historical investigations from the audit ledger |
| `GET` | `/api/investigations/{id}` | Retrieve complete investigation report by ID |
| `POST` | `/api/investigations/{id}/retry` | Re-run an existing investigation with fresh web crawl |
| `GET` | `/api/investigations/{id}/export` | Export investigation report as JSON or Markdown |

---

## Detailed Endpoints

### 1. System Health Check
`GET /api/health`

Returns the operational status of the investigation engine and external integrations.

#### Request Headers
- `Accept: application/json` (for programmatic API access)
- `Accept: text/html` (renders a browser-friendly status dashboard)

#### Response `200 OK`
```json
{
  "status": "ok",
  "version": "0.4.0",
  "timestamp": "2026-10-30T10:00:00.000Z",
  "tinyfish_configured": true,
  "llm_configured": false,
  "database": "sqlite",
  "cache_entries": 12,
  "environment": "development",
  "policy": "real_data_only"
}
```

---

### 2. Initiate Investigation
`POST /api/investigations`

Decomposes a claim, executes multi-tier TinyFish Search and Fetch, extracts verbatim quotations, assigns forensic verdicts, and commits results to SQLite.

#### Request Body
```json
{
  "input_text": "Presidency University Kolkata broke out into fire on campus",
  "input_url": "https://timesofindia.indiatimes.com",
  "include_agent_crawl": false
}
```

| Field | Type | Required | Description |
|---|---|:---:|---|
| `input_text` | string | Yes | The factual claim to investigate (10–1000 characters) |
| `input_url` | string | No | Optional reference URL to prioritize and crawl |
| `include_agent_crawl` | boolean | No | Optional headless browser exploration trigger |

#### Response `200 OK`
```json
{
  "id": "inv_93364a5aff29",
  "status": "completed",
  "overall_verdict": "SUPPORTED",
  "confidence_score": 0.88,
  "summary": "Verified against 6 independent sources crawled live via TinyFish.",
  "input_text": "Presidency University Kolkata broke out into fire on campus",
  "input_url": null,
  "created_at": "2026-10-30T09:41:00.000Z",
  "checked_at": "2026-10-30T09:41:08.000Z",
  "claim_units": [
    {
      "id": "unit_1",
      "claim_text": "Presidency University Kolkata broke out into fire on campus",
      "field": "factual_event"
    }
  ],
  "sources": [
    {
      "id": "src_c2ef0bfa28",
      "url": "https://timesofindia.indiatimes.com/city/kolkata/fire-at-presidency-university/...",
      "title": "Fire at Presidency University in Kolkata",
      "publisher": "Times of India",
      "published_at": "Date not reported",
      "quality": {
        "tier": "REPUTABLE_NEWS",
        "credibility": "MEDIUM",
        "is_official": false
      }
    }
  ],
  "findings": [
    {
      "claim_unit_id": "unit_1",
      "status": "SUPPORTED",
      "confidence": 0.88,
      "rationale": "Directly supported by 2 authentic web sources.",
      "evidence_ids": ["ev_3bdf891c"]
    }
  ],
  "evidence": [
    {
      "id": "ev_3bdf891c",
      "source_id": "src_c2ef0bfa28",
      "source_url": "https://timesofindia.indiatimes.com/city/kolkata/fire-at-presidency-university/...",
      "publisher": "Times of India",
      "claim_unit_id": "unit_1",
      "passage": "A fire broke out at the main campus of Presidency University on Friday morning...",
      "relation": "SUPPORTS"
    }
  ],
  "limitations": []
}
```

#### Error Response `503 Service Unavailable`
Returned when `TINYFISH_API_KEY` is missing or invalid:
```json
{
  "error": "TinyFish API credentials unconfigured",
  "detail": "Please configure TINYFISH_API_KEY in backend/.env to run live investigations."
}
```

---

### 3. List Audit Ledger
`GET /api/investigations?limit=50`

Returns a chronological list of past investigations from the SQLite audit ledger.

#### Query Parameters
- `limit` (integer, optional, default: 50): Max number of items to return.

#### Response `200 OK`
```json
{
  "investigations": [
    {
      "id": "inv_93364a5aff29",
      "input_text": "Presidency University Kolkata broke out into fire on campus",
      "status": "completed",
      "created_at": "2026-10-30T09:41:00.000Z",
      "completed_at": "2026-10-30T09:41:08.000Z",
      "claim_units_count": 1,
      "sources_count": 6,
      "findings_count": 1
    }
  ],
  "total": 1
}
```

---

### 4. Retrieve Investigation Report
`GET /api/investigations/{id}`

Returns the complete structured investigation report matching the given ID.

#### Path Parameters
- `id` (string, required): Investigation ID (e.g., `inv_93364a5aff29`).

#### Response `200 OK`
Returns the full investigation JSON object.

#### Error Response `404 Not Found`
```json
{
  "error": "Investigation not found"
}
```

---

### 5. Retry Investigation
`POST /api/investigations/{id}/retry`

Re-initiates an investigation with fresh web crawling using the original input claim.

---

### 6. Export Investigation
`GET /api/investigations/{id}/export?format=json|markdown`

Downloads the investigation report in the specified format.
