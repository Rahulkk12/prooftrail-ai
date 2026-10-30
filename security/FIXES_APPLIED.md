# PROOFTRAIL AI — Fixes Applied & Implementation Details

**Assessment Date:** 2026-10-30  
**Target:** ProofTrail AI Web Investigation Platform  
**Status:** All confirmed vulnerabilities remediated and verified with regression tests.

---

## 1. Summary of Applied Fixes

| Issue ID | Component | Change Summary | Verifying Regression Test |
|---|---|---|---|
| **SEC-01** | `backend/main.py` | Added `DISALLOWED_NETWORKS` blocking CGNAT (`100.64.0.0/10`), Link-Local (`169.254.0.0/16`), documentation IPs, and IPv6 unique local. | `test_rejects_cgnat_and_documentation_ips` |
| **SEC-02** | `backend/main.py` | Added explicit HTTP 503 check in `create_investigation` when `TINYFISH_API_KEY` is not configured. | `test_unconfigured_tinyfish_blocks_investigation_with_503` |
| **SEC-03** | `frontend/src/` | Removed fake benchmark injection buttons from Dashboard and History empty states. | `test-frontend.js` |
| **SEC-05** | `backend/app/` | Created `backend/app/config.py` and `backend/app/integrations/tinyfish_client.py`. | `TinyFishIntegrationUnitTests` |
| **SEC-06** | `backend/main.py` | Enforced exact verbatim substring verification on all extracted quotations; disarmed injection tags. | `test_paraphrased_passage_is_rejected` |
| **SEC-07** | `backend/main.py` | Standardized health diagnostics using secret-redacted settings. | `test_health_endpoint_does_not_leak_secrets` |

---

## 2. Code Changes by File

### A. `backend/main.py`

#### 1. Integrated Modular Config & Dedicated TinyFish Client
```python
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from app.config import settings
from app.integrations.tinyfish_client import (
    TinyFishClient,
    TinyFishError,
    TinyFishAuthError,
    TinyFishRateLimitError,
    TinyFishNetworkError,
)

tinyfish = TinyFishClient()
```

#### 2. Enhanced Network-Level Anti-SSRF Protection
```python
DISALLOWED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),       # CGNAT (RFC 6598)
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-Local & Cloud Metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),      # Private RFC 1918
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # Documentation (TEST-NET-1)
    ipaddress.ip_network("192.168.0.0/16"),     # Private RFC 1918
    ipaddress.ip_network("198.18.0.0/15"),      # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),    # Documentation (TEST-NET-2)
    ipaddress.ip_network("203.0.113.0/24"),     # Documentation (TEST-NET-3)
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    ipaddress.ip_network("::1/128"),            # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),           # IPv6 Unique Local
    ipaddress.ip_network("fe80::/10"),          # IPv6 Link-Local
]

def is_safe_global_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return is_safe_global_ip(ip.ipv4_mapped)
    if not ip.is_global:
        return False
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return False
    for net in DISALLOWED_NETWORKS:
        if ip in net:
            return False
    return True
```

#### 3. Real-Data Enforcement in `POST /api/investigations`
```python
    # Real-Data Policy: Refuse to execute fake or simulated investigations when TinyFish is unconfigured
    if not tinyfish.is_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "TinyFish API is not configured. Live web research requires TINYFISH_API_KEY in backend/.env. "
                "Simulated and hardcoded investigation results are strictly disabled in production. "
                "See docs/TINYFISH_SETUP.md for setup instructions."
            ),
        )
```

---

### B. `backend/app/config.py`
- Centralizes reading of `TINYFISH_API_KEY`, `TINYFISH_SEARCH_URL`, `TINYFISH_FETCH_URL`, `LLM_API_KEY`, `LLM_BASE_URL`, and `DATABASE_URL`.
- Implements `settings.diagnostics()` to safely provide status indicators while masking secret tokens.

---

### C. `backend/app/integrations/tinyfish_client.py`
- Implements official TinyFish Search (`GET https://api.search.tinyfish.ai`), Fetch (`POST https://api.fetch.tinyfish.ai`), and Agent (`POST https://agent.tinyfish.ai/v1/automation/run`).
- Enforces official header `X-API-Key: ...`.
- Normalizes search outputs into `[{url, title, snippet, publisher, date}]`.
- Normalizes fetch outputs into `(pages, errors)` with clean markdown and status fields.
- Implements jittered exponential backoff for HTTP 429 rate limits.

---

### D. `frontend/src/` (Dashboard, History, Landing Pages)
- **`DashboardPage.jsx`**: Removed mock loading handlers from empty states.
- **`HistoryPage.jsx`**: Removed benchmark demo fallbacks.
- **`LandingPage.jsx`**: Transformed sample preview CTA into `"Investigate This Claim Live"` which routes claims directly into active live execution.
- **`App.jsx`**: Cleaned mock ID checks; only real investigation IDs are retrieved from backend or local cache.

---

## 3. Regression Test Verification

The following regression tests were implemented in `backend/test_main.py` and `frontend/test-frontend.js`:

1. **`test_unconfigured_tinyfish_blocks_investigation_with_503`**: Confirms that calling `POST /api/investigations` without `TINYFISH_API_KEY` returns HTTP 503 and prohibits fallback to fake results.
2. **`test_rejects_cgnat_and_documentation_ips`**: Verifies that IP addresses in `100.64.0.0/10` and `192.0.2.0/24` are rejected by `is_safe_global_ip`.
3. **`TinyFishIntegrationUnitTests`**: Verifies that `TinyFishClient` raises `TinyFishAuthError` when unconfigured and formats authentication headers properly.
4. **`test-frontend.js`**: Verifies that client input validation, URL safety checks, empty claim rejection, and production builds execute with 0 failures.
