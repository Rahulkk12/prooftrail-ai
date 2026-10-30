"""Application configuration management for ProofTrail AI.

Centralizes environment variable parsing, validation, default endpoints,
and secret masking to prevent accidental credential leakage.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import NamedTuple
from dotenv import load_dotenv

# Automatically locate and load backend/.env if present
_current_dir = Path(__file__).resolve().parent
_backend_root = _current_dir.parent
_env_path = _backend_root / ".env"
if _env_path.exists():
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()


def _sanitize_url(url: str, default: str) -> str:
    cleaned = (url or "").strip().rstrip("/")
    return cleaned if cleaned else default


def _redact_key(key: str | None) -> str:
    if not key:
        return "<not-configured>"
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


class AppConfig:
    """Holds validated system settings with safe diagnostic logging."""

    def __init__(self) -> None:
        # Environment
        self.environment: str = os.getenv("ENVIRONMENT", "development").lower()

        # TinyFish Endpoints & Credentials
        self.tinyfish_api_key: str = os.getenv("TINYFISH_API_KEY", "").strip()
        self.tinyfish_search_url: str = _sanitize_url(
            os.getenv("TINYFISH_SEARCH_URL") or os.getenv("TINYFISH_SEARCH_BASE"),
            "https://api.search.tinyfish.ai",
        )
        self.tinyfish_fetch_url: str = _sanitize_url(
            os.getenv("TINYFISH_FETCH_URL") or os.getenv("TINYFISH_FETCH_BASE"),
            "https://api.fetch.tinyfish.ai",
        )
        self.tinyfish_agent_url: str = _sanitize_url(
            os.getenv("TINYFISH_AGENT_URL") or os.getenv("TINYFISH_AGENT_BASE"),
            "https://agent.tinyfish.ai",
        )

        # Optional LLM
        self.llm_api_key: str = os.getenv("LLM_API_KEY", "").strip()
        self.llm_base_url: str = _sanitize_url(
            os.getenv("LLM_BASE_URL"),
            "https://openrouter.ai/api/v1",
        )
        self.llm_model: str = os.getenv("LLM_MODEL", "openai/gpt-4.1-mini").strip()

        # Database
        # Supports DATABASE_URL (e.g. sqlite:///./data/prooftrail.db) or DATABASE_PATH
        raw_db = os.getenv("DATABASE_URL") or os.getenv("DATABASE_PATH", "./data/prooftrail.db")
        if raw_db.startswith("sqlite:///"):
            self.database_path: str = raw_db.replace("sqlite:///", "")
        else:
            self.database_path: str = raw_db

        # Network & Limits
        self.frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").strip()
        try:
            self.max_search_results: int = int(os.getenv("MAX_SEARCH_RESULTS", "8"))
        except ValueError:
            self.max_search_results = 8

        try:
            self.max_fetch_urls: int = int(os.getenv("MAX_FETCH_URLS", "8"))
        except ValueError:
            self.max_fetch_urls = 8

        try:
            self.fetch_ttl_seconds: int = int(os.getenv("FETCH_TTL_SECONDS", "0"))
        except ValueError:
            self.fetch_ttl_seconds = 0

    @property
    def is_tinyfish_configured(self) -> bool:
        return bool(self.tinyfish_api_key and len(self.tinyfish_api_key) > 5)

    @property
    def is_llm_configured(self) -> bool:
        return bool(self.llm_api_key and len(self.llm_api_key) > 5)

    def diagnostics(self) -> dict[str, str | bool | int]:
        """Diagnostic state safe to expose in health checks or logs."""
        return {
            "environment": self.environment,
            "tinyfish_configured": self.is_tinyfish_configured,
            "tinyfish_search_url": self.tinyfish_search_url,
            "tinyfish_fetch_url": self.tinyfish_fetch_url,
            "tinyfish_agent_url": self.tinyfish_agent_url,
            "llm_configured": self.is_llm_configured,
            "llm_model": self.llm_model if self.is_llm_configured else "<disabled>",
            "database_path": self.database_path,
            "max_search_results": self.max_search_results,
            "max_fetch_urls": self.max_fetch_urls,
        }

    def __repr__(self) -> str:
        return (
            f"<AppConfig environment={self.environment} "
            f"tinyfish_configured={self.is_tinyfish_configured} "
            f"tinyfish_key={_redact_key(self.tinyfish_api_key)} "
            f"llm_configured={self.is_llm_configured}>"
        )


# Singleton instance
settings = AppConfig()
