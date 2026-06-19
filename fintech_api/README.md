# Multi-Tenant Financial Reporting Platform API

A production-ready FastAPI backend providing multi-tenant financial ledger management with **LLM-powered AML/CFT compliance analysis** and **real-time multi-currency conversion** across USD, ZWG, and ZAR.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Application                    │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  POST /scan  │  │ POST /ledger │  │  GET /ledger  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │           │
│  ┌──────▼─────────────────▼───────────────────▼───────┐  │
│  │              JWT Tenant Middleware                   │  │
│  │        (tenant_id bound to every request)           │  │
│  └──────┬──────────────────────────────────────────────┘  │
│         │                                                  │
│  ┌──────▼──────────────────────────────────────────────┐  │
│  │              Business Logic Layer                    │  │
│  │                                                      │  │
│  │  ┌─────────────────┐    ┌────────────────────────┐  │  │
│  │  │ CurrencyService │    │  ComplianceAIService   │  │  │
│  │  │                 │    │                        │  │  │
│  │  │ USD ↔ ZWG ↔ ZAR │    │  Anthropic / OpenAI   │  │  │
│  │  │ Decimal Arith.  │    │  Structured JSON Mode  │  │  │
│  │  └────────┬────────┘    └───────────┬────────────┘  │  │
│  └───────────┼──────────────────────────┼───────────────┘  │
│              │                          │                   │
│  ┌───────────▼──────────────────────────▼───────────────┐  │
│  │           PostgreSQL (asyncpg + SQLAlchemy)           │  │
│  │    Row-Level Tenant Isolation on every query          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
fintech_api/
├── app/
│   ├── main.py                         # Application factory + lifespan
│   ├── core/
│   │   ├── config.py                   # Pydantic Settings (env vars)
│   │   ├── database.py                 # Async engine + session factory
│   │   └── security.py                 # JWT auth + TenantContext DI
│   ├── models/
│   │   └── financial.py                # SQLAlchemy ORM models
│   ├── schemas/
│   │   └── financial.py                # Pydantic v2 request/response schemas
│   ├── services/
│   │   ├── currency_service.py         # Decimal-safe FX conversion engine
│   │   └── compliance_ai.py            # LLM compliance + statement parser
│   └── api/
│       └── v1/
│           ├── router.py               # v1 router aggregator
│           └── endpoints/
│               ├── auth.py             # Token issuance (dev only)
│               └── ledger.py           # Core ledger API endpoints
├── alembic/
│   └── env.py                          # Async Alembic migration env
├── tests/
│   ├── test_currency_service.py        # Unit tests — no DB/LLM required
│   └── test_ledger_api.py              # Integration tests (mocked LLM)
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── requirements.txt
└── .env.example
```

---

## Quick Start

### 1. Prerequisites

- Python 3.12+
- PostgreSQL 14+ (or Docker)
- Anthropic or OpenAI API key

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, LLM_API_KEY, and JWT_SECRET
```

### 3. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Run with Docker Compose (recommended)

```bash
docker compose up --build
```

This starts PostgreSQL and the FastAPI server with hot-reload enabled. The API is available at `http://localhost:8000`.

### 5. Manual Database Setup

```bash
# Create the database
createdb fintech_db

# Run Alembic migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

---

## API Reference

### Authentication

All `/api/v1/ledger` endpoints require a `Bearer` JWT in the `Authorization` header.

**Get a token (development only):**

```http
POST /api/v1/auth/token
Content-Type: application/json

{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id":   "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "email":     "admin@yourbank.co.zw"
}
```

Response:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in_minutes": 60
}
```

---

### POST /api/v1/ledger/scan

Parse a raw bank statement and save all extracted transactions with compliance analysis.

**Request:**
```json
{
  "raw_text": "05/11/2024  TRANSFER FROM DELTA CORP  +2,500.00  USD\n10/11/2024  FUEL PURCHASE  -150.00  USD",
  "default_currency": "USD",
  "hint_tenant_timezone": "Africa/Harare"
}
```

**Response (201):**
```json
{
  "parsed_count": 2,
  "saved_count": 2,
  "failed_count": 0,
  "entries": [ ... ],
  "parse_notes": null,
  "detected_statement_currency": "USD"
}
```

---

### POST /api/v1/ledger

Submit a single structured ledger entry.

**Request:**
```json
{
  "amount": "9800.00",
  "original_currency": "ZAR",
  "description": "Cash deposit - Harare branch",
  "counterparty_name": "John Doe",
  "reference_number": "DEP-2024-001"
}
```

**Response (201):**
```json
{
  "id": "...",
  "tenant_id": "...",
  "amount": "9800.0000",
  "original_currency": "ZAR",
  "base_amount_usd": "522.6667",
  "exchange_rate_used": "0.05333333",
  "compliance_status": "SAFE",
  "compliance_category": "ROUTINE",
  "risk_score": "5.00",
  "ctr_required": false,
  "sar_required": false,
  "requires_manual_review": false,
  "llm_audit_summary": "Transaction appears routine...",
  "llm_flags": [],
  "is_parsed_entry": false,
  "created_at": "2024-11-15T10:30:00Z"
}
```

---

### GET /api/v1/ledger

Retrieve paginated, tenant-scoped transaction history.

**Query Parameters:**

| Parameter           | Type    | Description                                   |
|---------------------|---------|-----------------------------------------------|
| `page`              | int     | Page number, 1-indexed (default: 1)           |
| `page_size`         | int     | Entries per page, max 200 (default: 25)       |
| `compliance_status` | string  | Filter: `SAFE`, `FLAGGED`, `PENDING`, etc.    |
| `currency`          | string  | Filter: `USD`, `ZWG`, `ZAR`                  |
| `requires_review`   | bool    | Filter entries needing manual review          |
| `ctr_required`      | bool    | Filter entries requiring CTR filing           |
| `sar_required`      | bool    | Filter entries requiring SAR filing           |

**Response (200):**
```json
{
  "items": [ ... ],
  "total": 47,
  "page": 1,
  "page_size": 25,
  "total_pages": 2,
  "tenant_id": "..."
}
```

---

## Compliance Categories

| Category      | Description                                      |
|---------------|--------------------------------------------------|
| `ROUTINE`     | Normal retail/business transaction               |
| `CTR`         | Currency Transaction Report required (≥$10,000) |
| `SAR`         | Suspicious Activity Report required              |
| `STRUCTURING` | Sub-threshold structuring pattern detected       |
| `HIGH_VALUE`  | Large-value above internal threshold             |
| `CROSS_BORDER`| International transfer                           |
| `THIRD_PARTY` | Unverified third-party payee                     |

## Compliance Status Flow

```
Submitted → PENDING → SAFE
                   → FLAGGED → (manual review) → SAFE / BLOCKED / ESCALATED
                   → BLOCKED
```

---

## Running Tests

```bash
# Unit tests only (no DB or LLM keys needed)
pytest tests/test_currency_service.py -v

# Full integration tests (requires PostgreSQL)
pytest tests/ -v --cov=app

# With coverage report
pytest tests/ --cov=app --cov-report=html
```

---

## Currency Conversion

Exchange rates are configured via environment variables as **Decimal strings** (never floats):

```
EXCHANGE_RATE_USD_TO_ZWG=3586.00   # 1 USD = 3586 ZWG
EXCHANGE_RATE_USD_TO_ZAR=18.75     # 1 USD = 18.75 ZAR
```

All conversion paths go through a USD pivot:
- `ZAR → USD → ZWG` for cross-currency conversions
- All stored amounts use `Numeric(18, 4)` in PostgreSQL
- Python `Decimal` with `ROUND_HALF_UP` throughout

View live rates at: `GET /health/rates`

---

## Security

- **Multi-tenant isolation**: Every query is filtered by `tenant_id` extracted from the JWT — enforced at the ORM layer, not just routing.
- **JWT HS256**: Tokens bind a `user_id` and `tenant_id`. The `/auth/token` endpoint is disabled in production.
- **No floats**: All financial arithmetic uses Python `Decimal` and PostgreSQL `Numeric(18,4)`.
- **Async design**: All DB operations use `async/await` with `asyncpg` for safe concurrent request handling.
- **Production hardening**: CORS locked down, Swagger UI disabled, SQL echo off, DEBUG off — all enforced by `model_validator` in Settings.
