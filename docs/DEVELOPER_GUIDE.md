# PROOFTRAIL AI — Developer & Contributor Guide

**Repository:** `https://github.com/Rahulkk12/prooftrail-ai`  
**Tech Stack:** React 18, Vite, Node.js / FastAPI, SQLite, TinyFish SDK

---

## 1. Local Development Setup

### Backend Setup
1. Enter the `backend/` directory:
```bash
cd backend
```
2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
3. Open `backend/.env` and add your TinyFish API key:
```env
TINYFISH_API_KEY=sk-tinyfish-...
```
4. Start the backend engine:
```bash
# Using Node.js runtime:
node server.mjs

# Or using Python FastAPI:
uvicorn main:app --reload --port 8000
```
The server will start on `http://localhost:8000`. You can verify by visiting `http://localhost:8000/docs`.

---

### Frontend Setup
1. In a separate terminal, enter the `frontend/` directory:
```bash
cd frontend
```
2. Install dependencies:
```bash
npm install --legacy-peer-deps
```
3. Start the Vite development server:
```bash
npm run dev
```
4. Open `http://localhost:5173` in your browser. Requests to `/api/*` are automatically forwarded to `http://localhost:8000` via Vite's proxy configuration in `frontend/vite.config.js`.

---

## 2. Running Automated Tests

### Frontend Component Tests
Run the comprehensive 46-assertion component test suite:
```bash
npm test --prefix frontend
```
*Expected Result: 46 passing assertions.*

### Production Build Verification
Verify the frontend builds cleanly without bundler or JSX errors:
```bash
npm run build --prefix frontend
```

### Backend Automated Tests (Python)
If Python 3.11+ is installed:
```bash
cd backend
pytest -v
```

---

## 3. Code Conventions & Integrity Rules

1. **Strict Real-Data Enforcement**:
   - Never inject hardcoded demonstration results or synthetic quotations into live code paths.
   - If TinyFish is unconfigured, return HTTP 503 instead of falling back to fake citations.
2. **Verbatim Quotation Integrity**:
   - When extracting evidence from retrieved pages, verify that the passage is an exact substring of the retrieved document.
3. **SSRF Guardrails**:
   - Always validate external URLs using `isSafePublicUrl()` to reject private IPs, loopback, link-local, and cloud metadata addresses.
4. **Secrets Management**:
   - Never commit `.env` or hardcode API keys in any source file.
