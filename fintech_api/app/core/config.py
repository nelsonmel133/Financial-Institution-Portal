"""
app/core/config.py

Central configuration manager for the Multi-Tenant Financial Reporting Platform.
Parses environment variables using Pydantic Settings with validation and safety defaults.
"""

from __future__ import annotations

import secrets
from enum import Enum
from functools import lru_cache
from typing import Literal

from pydantic import AnyUrl, Field, PostgresDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "Multi-Tenant Financial Reporting Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # ─── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/fintech_db",
        description="Async PostgreSQL connection string (asyncpg driver required).",
    )
    DB_POOL_SIZE: int = Field(default=10, ge=1, le=100)
    DB_MAX_OVERFLOW: int = Field(default=20, ge=0, le=200)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=5)
    DB_ECHO_SQL: bool = False

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError(
                "DATABASE_URL must use the asyncpg driver: "
                "'postgresql+asyncpg://user:pass@host:port/db'"
            )
        return v

    # ─── JWT / Security ────────────────────────────────────────────────────────
    JWT_SECRET: SecretStr = Field(
        default_factory=lambda: secrets.token_urlsafe(64),
        description="HS256 signing secret. Override with a stable value in production.",
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, ge=5, le=1440)

    # ─── LLM / AI ──────────────────────────────────────────────────────────────
    LLM_PROVIDER: LLMProvider = LLMProvider.ANTHROPIC
    LLM_API_KEY: SecretStr = Field(
        ...,
        description="API key for the configured LLM provider (OpenAI or Anthropic).",
    )
    LLM_MODEL_OPENAI: str = "gpt-4o"
    LLM_MODEL_ANTHROPIC: str = "claude-sonnet-4-6"
    LLM_MAX_TOKENS: int = Field(default=2048, ge=256, le=8192)
    LLM_TEMPERATURE: float = Field(default=0.0, ge=0.0, le=1.0)
    LLM_REQUEST_TIMEOUT: int = Field(default=60, ge=10, le=300)

    # ─── Currency Exchange ──────────────────────────────────────────────────────
    # Base currency for all ledger normalisation
    BASE_CURRENCY: Literal["USD", "ZWG", "ZAR"] = "USD"

    # Static fallback rates (overridden at runtime by live feed if available).
    # Format: how many BASE_CURRENCY units equal 1 unit of that currency.
    EXCHANGE_RATE_USD_TO_ZWG: str = Field(
        default="3586.00",
        description="1 USD → N ZWG (Decimal string to avoid float precision loss).",
    )
    EXCHANGE_RATE_USD_TO_ZAR: str = Field(
        default="18.75",
        description="1 USD → N ZAR.",
    )

    # ─── Pagination ─────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = Field(default=25, ge=1, le=200)
    MAX_PAGE_SIZE: int = Field(default=200, ge=1, le=1000)

    # ─── Compliance Thresholds ──────────────────────────────────────────────────
    # Regulatory reporting threshold in USD equivalent
    CTR_THRESHOLD_USD: str = Field(
        default="10000.00",
        description="Currency Transaction Report threshold (USD equivalent).",
    )
    SAR_STRUCTURING_WINDOW_DAYS: int = Field(
        default=5,
        description="Sliding window (days) for structuring pattern detection.",
    )
    SAR_STRUCTURING_TRANSACTION_COUNT: int = Field(
        default=3,
        description="Minimum sub-threshold transactions within window to flag structuring.",
    )

    @model_validator(mode="after")
    def production_safety_checks(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production.")
            if self.DB_ECHO_SQL:
                raise ValueError("DB_ECHO_SQL must be False in production.")
            secret_val = self.JWT_SECRET.get_secret_value()
            if len(secret_val) < 32:
                raise ValueError(
                    "JWT_SECRET must be at least 32 characters in production."
                )
        return self

    @property
    def active_llm_model(self) -> str:
        """Returns the model identifier for the configured LLM provider."""
        return (
            self.LLM_MODEL_OPENAI
            if self.LLM_PROVIDER == LLMProvider.OPENAI
            else self.LLM_MODEL_ANTHROPIC
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached singleton accessor for application settings.
    Use FastAPI dependency injection: Depends(get_settings).
    """
    return Settings()


# Module-level convenience reference
settings: Settings = get_settings()
