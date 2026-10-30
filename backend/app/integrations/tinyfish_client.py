"""Dedicated integration client for TinyFish Web Search, Fetch, and Agent APIs.

Adheres to official TinyFish API contracts, bounded timeouts, rate-limit backoff,
safe error normalization, and credential protection.
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any
import httpx

from app.config import settings

logger = logging.getLogger("prooftrail.tinyfish")


class TinyFishError(Exception):
    """Base exception for all TinyFish API integration errors."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class TinyFishAuthError(TinyFishError):
    """Raised when TinyFish API credentials are missing, invalid, or unauthorized."""


class TinyFishRateLimitError(TinyFishError):
    """Raised when TinyFish API rate limits are exceeded (HTTP 429)."""


class TinyFishNetworkError(TinyFishError):
    """Raised when network connectivity, timeouts, or DNS failures occur."""


class TinyFishClient:
    """Production client for TinyFish web intelligence APIs.
    
    Provides bounded retries, exponential backoff, response normalization,
    and strict secret masking.
    """

    def __init__(
        self,
        api_key: str | None = None,
        search_url: str | None = None,
        fetch_url: str | None = None,
        agent_url: str | None = None,
        timeout_seconds: float = 12.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = (api_key or settings.tinyfish_api_key).strip()
        self.search_url = (search_url or settings.tinyfish_search_url).rstrip("/")
        self.fetch_url = (fetch_url or settings.tinyfish_fetch_url).rstrip("/")
        self.agent_url = (agent_url or settings.tinyfish_agent_url).rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 5)

    def _headers(self) -> dict[str, str]:
        if not self.is_configured:
            raise TinyFishAuthError(
                "TinyFish API key is not configured. Set TINYFISH_API_KEY in backend/.env.",
                status_code=401,
            )
        return {
            "X-API-Key": self.api_key,
            "Accept": "application/json",
            "User-Agent": "ProofTrail-AI/0.4.0 (Integrity Verification Platform)",
        }

    async def _execute_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        params: dict[str, Any] | None = None,
        json_data: Any | None = None,
    ) -> httpx.Response:
        """Executes an HTTP request with bounded retry and jittered exponential backoff."""
        delay = 0.8
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json_data,
                    timeout=self.timeout_seconds,
                )

                # Success
                if response.status_code == 200:
                    return response

                # Authentication / Forbidden
                if response.status_code in (401, 403):
                    msg = f"TinyFish authentication failure (HTTP {response.status_code}). Verify TINYFISH_API_KEY."
                    logger.error(msg)
                    raise TinyFishAuthError(msg, status_code=response.status_code)

                # Rate Limit (429)
                if response.status_code == 429:
                    retry_after = 2.0
                    if "retry-after" in response.headers:
                        try:
                            retry_after = float(response.headers["retry-after"])
                        except (ValueError, TypeError):
                            pass
                    if attempt < self.max_retries:
                        logger.warning(
                            f"TinyFish rate limited (429). Attempt {attempt}/{self.max_retries}. Backing off {retry_after}s..."
                        )
                        await asyncio.sleep(retry_after)
                        continue
                    raise TinyFishRateLimitError(
                        "TinyFish API rate limit exceeded. Please retry shortly.",
                        status_code=429,
                    )

                # Server errors (5xx)
                if response.status_code >= 500:
                    if attempt < self.max_retries:
                        jitter = random.uniform(0.1, 0.4)
                        logger.warning(
                            f"TinyFish server error ({response.status_code}). Attempt {attempt}/{self.max_retries}. Retrying in {delay + jitter:.1f}s..."
                        )
                        await asyncio.sleep(delay + jitter)
                        delay *= 1.8
                        continue
                    raise TinyFishError(
                        f"TinyFish service temporarily unavailable (HTTP {response.status_code}).",
                        status_code=response.status_code,
                    )

                # Client errors (4xx)
                err_text = response.text[:200]
                raise TinyFishError(
                    f"TinyFish API request rejected (HTTP {response.status_code}): {err_text}",
                    status_code=response.status_code,
                )

            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                last_error = exc
                if attempt < self.max_retries:
                    jitter = random.uniform(0.1, 0.3)
                    logger.warning(
                        f"TinyFish connection error ({type(exc).__name__}). Attempt {attempt}/{self.max_retries}. Retrying in {delay + jitter:.1f}s..."
                    )
                    await asyncio.sleep(delay + jitter)
                    delay *= 1.8
                    continue
                raise TinyFishNetworkError(
                    f"Network error connecting to TinyFish ({type(exc).__name__}).",
                ) from exc

        raise TinyFishError(f"TinyFish request exhausted retries: {last_error}")

    async def search(
        self,
        query: str,
        *,
        purpose: str | None = None,
        location: str = "IN",
        language: str = "en",
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Executes a real web discovery query using TinyFish Search.
        
        GET https://api.search.tinyfish.ai?q=...&location=...&language=...
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        headers = self._headers()
        params: dict[str, Any] = {
            "q": clean_query,
            "location": location,
            "language": language,
        }
        if purpose:
            params["purpose"] = purpose

        effective_limit = limit or settings.max_search_results

        async with httpx.AsyncClient() as client:
            res = await self._execute_with_retry(
                client,
                "GET",
                self.search_url,
                headers=headers,
                params=params,
            )

        try:
            data = res.json()
        except Exception as exc:
            raise TinyFishError(f"TinyFish Search returned malformed non-JSON response: {exc}") from exc

        # Normalize response schema: handles list or {"results": [...]} or {"items": [...]}
        raw_items: list[Any] = []
        if isinstance(data, list):
            raw_items = data
        elif isinstance(data, dict):
            raw_items = data.get("results") or data.get("items") or data.get("data") or []

        normalized: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        for item in raw_items:
            if not isinstance(item, dict):
                continue
            url = item.get("url") or item.get("link")
            if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                continue
            if url in seen_urls:
                continue

            seen_urls.add(url)
            normalized.append({
                "url": url,
                "title": (item.get("title") or item.get("name") or url).strip(),
                "snippet": (item.get("snippet") or item.get("description") or "").strip(),
                "publisher": (item.get("publisher") or item.get("site_name") or "").strip(),
                "date": item.get("date") or item.get("published_date") or None,
            })

            if len(normalized) >= effective_limit:
                break

        logger.info(f"TinyFish Search query '{clean_query[:50]}' returned {len(normalized)} real URLs.")
        return normalized

    async def fetch(
        self,
        urls: list[str],
        *,
        purpose: str | None = None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Retrieves actual page content for target URLs using TinyFish Fetch.
        
        POST https://api.fetch.tinyfish.ai
        Body: {"urls": ["https://..."], "purpose": ...}
        """
        clean_urls = [u.strip() for u in urls if isinstance(u, str) and u.startswith(("http://", "https://"))]
        if not clean_urls:
            return [], []

        headers = self._headers()
        headers["Content-Type"] = "application/json"

        body: dict[str, Any] = {"urls": clean_urls}
        if purpose:
            body["purpose"] = purpose

        async with httpx.AsyncClient() as client:
            res = await self._execute_with_retry(
                client,
                "POST",
                self.fetch_url,
                headers=headers,
                json_data=body,
            )

        try:
            data = res.json()
        except Exception as exc:
            raise TinyFishError(f"TinyFish Fetch returned malformed non-JSON response: {exc}") from exc

        # Schema normalization: handles {"pages": [...], "errors": [...]} or list of pages
        raw_pages: list[Any] = []
        raw_errors: list[Any] = []

        if isinstance(data, dict):
            raw_pages = data.get("pages") or data.get("results") or []
            raw_errors = data.get("errors") or []
        elif isinstance(data, list):
            raw_pages = data

        normalized_pages: list[dict[str, Any]] = []
        for p in raw_pages:
            if not isinstance(p, dict):
                continue
            u = p.get("url") or p.get("requested_url")
            if not isinstance(u, str):
                continue

            text_content = p.get("text") or p.get("markdown") or p.get("content") or ""
            normalized_pages.append({
                "url": u,
                "final_url": p.get("final_url") or u,
                "title": (p.get("title") or u).strip(),
                "text": text_content.strip() if isinstance(text_content, str) else "",
                "published_date": p.get("published_date") or p.get("date") or None,
                "status": p.get("status") or 200,
            })

        normalized_errors: list[dict[str, Any]] = []
        for e in raw_errors:
            if isinstance(e, dict):
                normalized_errors.append({
                    "url": e.get("url", "unknown"),
                    "error": str(e.get("error", "fetch failure")),
                })

        logger.info(
            f"TinyFish Fetch for {len(clean_urls)} URLs completed: {len(normalized_pages)} retrieved, {len(normalized_errors)} errors."
        )
        return normalized_pages, normalized_errors

    async def run_agent(self, url: str, goal: str) -> dict[str, Any]:
        """Executes a browser-driven multi-step automation using TinyFish Agent.
        
        POST https://agent.tinyfish.ai/v1/automation/run
        """
        if not self.is_configured:
            raise TinyFishAuthError("TinyFish Agent requires TINYFISH_API_KEY.", status_code=401)

        headers = self._headers()
        headers["Content-Type"] = "application/json"
        body = {"url": url.strip(), "goal": goal.strip()}

        async with httpx.AsyncClient() as client:
            res = await self._execute_with_retry(
                client,
                "POST",
                f"{self.agent_url}/v1/automation/run",
                headers=headers,
                json_data=body,
            )

        try:
            return res.json()
        except Exception as exc:
            raise TinyFishError(f"TinyFish Agent returned invalid JSON: {exc}") from exc
