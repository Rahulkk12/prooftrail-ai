# PROOFTRAIL AI — Interactive Swagger UI Guide

**UI Location:** `http://localhost:8000/docs` (or `http://localhost:8000`)  
**OpenAPI Specification:** `http://localhost:8000/openapi.json`

---

## 1. Accessing Swagger UI

Once the backend is started (`node backend/server.mjs` or `uvicorn main:app --port 8000`), open your browser to:

👉 **[http://localhost:8000/docs](http://localhost:8000/docs)**

You will see the dark-themed PROOFTRAIL AI header and the interactive OpenAPI documentation suite.

---

## 2. How to Test Endpoints Interactively

### Testing `GET /api/health`
1. Expand the **Health & System** block.
2. Click the **"Try it out"** button in the top-right corner.
3. Click the blue **"Execute"** button.
4. Verify the **Response Body** returns `200 OK` with `"tinyfish_configured": true`.

### Testing `POST /api/investigations` (Live Web Audit)
1. Expand the **Investigations** section and click on `POST /api/investigations`.
2. Click **"Try it out"**.
3. In the Request body editor, enter your claim:
```json
{
  "input_text": "Government of India National Scholarship Portal registration open",
  "input_url": "https://scholarships.gov.in"
}
```
4. Click **"Execute"**.
5. Swagger UI dispatches the real HTTP request to the backend. The backend queries TinyFish Search, fetches the official page, extracts verbatim citations, and returns the audited report in ~4–8 seconds.
6. Inspect the returned JSON:
   - `overall_verdict`: `SUPPORTED`
   - `sources`: Real URLs crawled from `scholarships.gov.in`
   - `evidence`: Exact verbatim quotes verified from the source HTML/markdown

### Testing `GET /api/investigations` (Audit History)
1. Click `GET /api/investigations`.
2. Click **"Try it out"** -> **"Execute"**.
3. View all past investigations stored in the local SQLite audit ledger.

---

## 3. Quick Links & Navigation

- **Swagger Documentation:** `http://localhost:8000/docs`
- **Frontend Intelligence Dashboard:** `http://localhost:5173`
- **Health Check Status Card:** `http://localhost:8000/api/health`
