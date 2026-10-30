# PROOFTRAIL AI — Production Deployment Guide

**Target Environment:** Linux / Docker / Cloud VM / Windows Server  
**Engine:** Node.js v20+ / Python 3.11+ / React 18 / Nginx  
**Persistence:** Embedded SQLite with WAL mode / PostgreSQL (optional)

---

## 1. Quick Production Run with Docker Compose

The fastest way to deploy the entire production stack (Nginx reverse proxy, Frontend SPA, and Backend Engine) is via Docker Compose:

```bash
# 1. Clone repository
git clone https://github.com/Rahulkk12/prooftrail-ai.git
cd prooftrail-ai

# 2. Configure environment credentials
cp backend/.env.example backend/.env
# Edit backend/.env and supply your TINYFISH_API_KEY

# 3. Launch Docker Compose stack
docker compose up -d --build
```

Access the application:
- **Web Dashboard:** `http://localhost:8080`
- **Swagger Documentation:** `http://localhost:8000/docs`
- **Health Endpoint:** `http://localhost:8080/api/health`

---

## 2. Bare-Metal & Cloud VM Deployment (systemd / PM2)

If running directly on a Linux virtual machine (AWS EC2, DigitalOcean, Hetzner, GCP Compute Engine):

### Step A: Prerequisites
```bash
sudo apt-get update && sudo apt-get install -y nodejs npm git sqlite3
```

### Step B: Build Frontend
```bash
cd /opt/prooftrail-ai/frontend
npm install --legacy-peer-deps
npm run build
```

### Step C: Configure Backend Service (`/etc/systemd/system/prooftrail-backend.service`)
```ini
[Unit]
Description=ProofTrail AI Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/prooftrail-ai/backend
EnvironmentFile=/opt/prooftrail-ai/backend/.env
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now prooftrail-backend
```

### Step D: Nginx Reverse Proxy Configuration (`/etc/nginx/sites-available/prooftrail`)
```nginx
server {
    listen 80;
    server_name prooftrail.yourdomain.com;

    # Frontend Static SPA
    root /opt/prooftrail-ai/frontend/dist;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' http://localhost:8000 https://api.search.tinyfish.ai https://api.fetch.tinyfish.ai; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy to Backend Engine
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger Documentation Proxy
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
    }
}
```

---

## 3. Environment Variables Reference

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `TINYFISH_API_KEY` | **Yes** | — | Authentication key for TinyFish Search and Fetch APIs |
| `TINYFISH_SEARCH_URL` | No | `https://api.search.tinyfish.ai` | TinyFish Search endpoint |
| `TINYFISH_FETCH_URL` | No | `https://api.fetch.tinyfish.ai` | TinyFish Fetch endpoint |
| `PORT` | No | `8000` | Port for the backend service |
| `DATABASE_PATH` | No | `./data/prooftrail.db` | Path to SQLite audit ledger |
| `ENVIRONMENT` | No | `production` | Deployment mode flag (`production` or `development`) |
| `FETCH_TTL_SECONDS` | No | `0` (fresh) | Cache duration for retrieved pages (set to 0 for real-time freshness) |

---

## 4. Operational Monitoring & Health Check

Automated health checks can probe the API health endpoint:
```bash
curl -f http://localhost:8000/api/health || exit 1
```

A healthy response returns HTTP 200 with:
```json
{
  "status": "ok",
  "tinyfish_configured": true,
  "database": "sqlite"
}
```
