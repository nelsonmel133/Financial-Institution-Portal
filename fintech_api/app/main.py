"""
app/main.py

FastAPI application factory.

Responsibilities:
- Registers the async lifespan handler (DB startup check, graceful shutdown).
- Mounts the v1 API router.
- Configures global exception handlers for validation errors and unhandled exceptions.
- Exposes /health for load-balancer probes.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import engine

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Async lifespan context manager.
    Runs startup logic before the first request, teardown after the last.
    """
    logger.info("Starting %s v%s [env=%s]", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    # Verify database connectivity on startup
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection verified.")
    except Exception as exc:
        logger.critical("Database connection failed on startup: %s", exc)
        raise RuntimeError("Cannot connect to the database.") from exc

    yield  # ← Application runs here

    # Graceful shutdown
    logger.info("Shutting down — disposing database engine.")
    await engine.dispose()
    logger.info("Shutdown complete.")


# ─── Application Factory ──────────────────────────────────────────────────────

def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Multi-Tenant Financial Reporting Platform with LLM-powered compliance "
            "analysis and multi-currency conversion (USD / ZWG / ZAR)."
        ),
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Tighten allow_origins for production deployments
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if not settings.is_production else [],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    # ── Request Timing Middleware ─────────────────────────────────────────────
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.2f}"
        return response

    # ── Exception Handlers ────────────────────────────────────────────────────

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Returns structured 422 responses with field-level error detail."""
        logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Request validation failed.",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catches all unhandled exceptions and returns a safe 500 response."""
        logger.exception(
            "Unhandled exception on %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An internal server error occurred.",
                "type": type(exc).__name__,
            },
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_v1_router)

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.get(
        "/health",
        tags=["Infrastructure"],
        summary="Health check for load balancers and monitoring",
        include_in_schema=False,
    )
    async def health_check() -> dict:
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
        }

    @app.get(
        "/health/rates",
        tags=["Infrastructure"],
        summary="Current exchange rate snapshot",
    )
    async def exchange_rates() -> dict:
        from app.services.currency_service import currency_service
        rates = currency_service.get_rates_snapshot()
        return {
            "base_currency": settings.BASE_CURRENCY,
            "rates": {k: str(v) for k, v in rates.items()},
        }

    return app


app = create_application()
