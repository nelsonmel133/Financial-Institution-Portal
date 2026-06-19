"""
tests/test_ledger_api.py

Integration tests for the /api/v1/ledger endpoints.
Uses httpx.AsyncClient with the FastAPI TestClient pattern.
LLM calls are mocked — no real API keys needed to run tests.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.financial import ComplianceCategory, ComplianceStatus, Currency
from app.schemas.financial import ComplianceFlag, LLMComplianceResult, LLMStatementParseResult, ParsedTransaction

# ─── Test Database Setup ──────────────────────────────────────────────────────

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/fintech_test_db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


# ─── Fixtures ─────────────────────────────────────────────────────────────────

TENANT_ID = uuid.uuid4()
USER_ID = uuid.uuid4()
TEST_EMAIL = "test@fintech.co.zw"


@pytest.fixture(scope="session")
def valid_token() -> str:
    return create_access_token(
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        email=TEST_EMAIL,
    )


@pytest.fixture(scope="session")
def auth_headers(valid_token) -> dict[str, str]:
    return {"Authorization": f"Bearer {valid_token}"}


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    """Create all tables at test session start; drop at end."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ─── Mock LLM Result Factories ────────────────────────────────────────────────

def _safe_compliance_result() -> LLMComplianceResult:
    return LLMComplianceResult(
        compliance_status=ComplianceStatus.SAFE,
        compliance_category=ComplianceCategory.ROUTINE,
        risk_score=Decimal("5.00"),
        flags=[],
        requires_manual_review=False,
        ctr_required=False,
        sar_required=False,
        audit_summary="Transaction appears routine. No risk indicators detected.",
        detected_patterns=[],
    )


def _flagged_compliance_result() -> LLMComplianceResult:
    return LLMComplianceResult(
        compliance_status=ComplianceStatus.FLAGGED,
        compliance_category=ComplianceCategory.STRUCTURING,
        risk_score=Decimal("72.00"),
        flags=[
            ComplianceFlag(
                code="STRUCTURING_ATTEMPT",
                severity="HIGH",
                description="Multiple sub-threshold deposits detected within window.",
                regulatory_basis="FATF Recommendation 29",
            )
        ],
        requires_manual_review=True,
        ctr_required=False,
        sar_required=True,
        audit_summary="Possible structuring pattern. SAR required.",
        detected_patterns=["smurfing"],
    )


def _ctr_compliance_result() -> LLMComplianceResult:
    return LLMComplianceResult(
        compliance_status=ComplianceStatus.FLAGGED,
        compliance_category=ComplianceCategory.CTR,
        risk_score=Decimal("45.00"),
        flags=[
            ComplianceFlag(
                code="CTR_THRESHOLD_BREACH",
                severity="HIGH",
                description="Transaction exceeds USD 10,000 CTR reporting threshold.",
                regulatory_basis="Bank Secrecy Act 31 CFR 1010.311",
            )
        ],
        requires_manual_review=True,
        ctr_required=True,
        sar_required=False,
        audit_summary="CTR filing required. Amount exceeds $10,000 threshold.",
        detected_patterns=[],
    )


# ─── Health Check Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_exchange_rates_endpoint(client):
    response = await client.get("/health/rates")
    assert response.status_code == 200
    data = response.json()
    assert "rates" in data
    assert "USD_per_ZWG" in data["rates"]
    assert "USD_per_ZAR" in data["rates"]


# ─── Authentication Tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ledger_requires_auth(client):
    response = await client.get("/api/v1/ledger")
    assert response.status_code == 403  # No Authorization header


@pytest.mark.asyncio
async def test_ledger_rejects_invalid_token(client):
    response = await client.get(
        "/api/v1/ledger",
        headers={"Authorization": "Bearer not.a.valid.token"},
    )
    assert response.status_code == 401


# ─── POST /api/v1/ledger Tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_ledger_entry_usd(client, auth_headers):
    """Standard USD entry — compliance AI returns SAFE."""
    with patch(
        "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
        new=AsyncMock(return_value=_safe_compliance_result()),
    ):
        response = await client.post(
            "/api/v1/ledger",
            headers=auth_headers,
            json={
                "amount": "500.00",
                "original_currency": "USD",
                "description": "Monthly supplier payment - Office Supplies Ltd",
                "counterparty_name": "Office Supplies Ltd",
                "reference_number": "INV-2024-0891",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_currency"] == "USD"
    assert data["compliance_status"] == "SAFE"
    assert data["risk_score"] == "5.00"
    assert data["ctr_required"] is False
    assert data["requires_manual_review"] is False
    assert data["base_amount_usd"] == "500.0000"
    assert data["tenant_id"] == str(TENANT_ID)


@pytest.mark.asyncio
async def test_create_ledger_entry_zar_conversion(client, auth_headers):
    """ZAR entry — verify correct USD conversion at 18.75 rate."""
    with patch(
        "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
        new=AsyncMock(return_value=_safe_compliance_result()),
    ):
        response = await client.post(
            "/api/v1/ledger",
            headers=auth_headers,
            json={
                "amount": "1875.00",
                "original_currency": "ZAR",
                "description": "ZAR transfer from Johannesburg branch",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_currency"] == "ZAR"
    assert data["base_amount_usd"] == "100.0000"  # 1875 / 18.75 = 100


@pytest.mark.asyncio
async def test_create_ledger_entry_zwg_conversion(client, auth_headers):
    """ZWG entry — verify correct USD conversion at 3586 rate."""
    with patch(
        "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
        new=AsyncMock(return_value=_safe_compliance_result()),
    ):
        response = await client.post(
            "/api/v1/ledger",
            headers=auth_headers,
            json={
                "amount": "3586.00",
                "original_currency": "ZWG",
                "description": "ZWG local business payment",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["base_amount_usd"] == "1.0000"  # 3586 / 3586 = 1


@pytest.mark.asyncio
async def test_create_ledger_entry_flagged_structuring(client, auth_headers):
    """Structuring detection — LLM flags the transaction."""
    with patch(
        "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
        new=AsyncMock(return_value=_flagged_compliance_result()),
    ):
        response = await client.post(
            "/api/v1/ledger",
            headers=auth_headers,
            json={
                "amount": "9800.00",
                "original_currency": "USD",
                "description": "Cash deposit - third branch visit this week",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["compliance_status"] == "FLAGGED"
    assert data["compliance_category"] == "STRUCTURING"
    assert data["sar_required"] is True
    assert data["requires_manual_review"] is True
    assert data["risk_score"] == "72.00"
    flags = data["llm_flags"]
    assert isinstance(flags, list)
    assert any(f["code"] == "STRUCTURING_ATTEMPT" for f in flags)


@pytest.mark.asyncio
async def test_create_ledger_entry_ctr_threshold(client, auth_headers):
    """Amount over $10,000 — LLM flags CTR requirement."""
    with patch(
        "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
        new=AsyncMock(return_value=_ctr_compliance_result()),
    ):
        response = await client.post(
            "/api/v1/ledger",
            headers=auth_headers,
            json={
                "amount": "15000.00",
                "original_currency": "USD",
                "description": "Large wire transfer - international trade settlement",
                "counterparty_name": "Harare Exports (Pvt) Ltd",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["ctr_required"] is True
    assert data["compliance_category"] == "CTR"


@pytest.mark.asyncio
async def test_create_entry_rejects_negative_amount(client, auth_headers):
    response = await client.post(
        "/api/v1/ledger",
        headers=auth_headers,
        json={
            "amount": "-100.00",
            "original_currency": "USD",
            "description": "Negative amount test",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_entry_rejects_zero_amount(client, auth_headers):
    response = await client.post(
        "/api/v1/ledger",
        headers=auth_headers,
        json={
            "amount": "0",
            "original_currency": "USD",
            "description": "Zero amount test",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_entry_rejects_invalid_currency(client, auth_headers):
    response = await client.post(
        "/api/v1/ledger",
        headers=auth_headers,
        json={
            "amount": "100.00",
            "original_currency": "GBP",
            "description": "Unsupported currency test",
        },
    )
    assert response.status_code == 422


# ─── GET /api/v1/ledger Tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_ledger_entries_returns_paginated(client, auth_headers):
    response = await client.get("/api/v1/ledger", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "total_pages" in data
    assert "tenant_id" in data
    assert data["tenant_id"] == str(TENANT_ID)
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_ledger_pagination_params(client, auth_headers):
    response = await client.get(
        "/api/v1/ledger?page=1&page_size=5",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 5
    assert len(data["items"]) <= 5


@pytest.mark.asyncio
async def test_list_ledger_filter_by_status(client, auth_headers):
    response = await client.get(
        "/api/v1/ledger?compliance_status=SAFE",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["compliance_status"] == "SAFE"


@pytest.mark.asyncio
async def test_list_ledger_filter_by_currency(client, auth_headers):
    response = await client.get(
        "/api/v1/ledger?currency=USD",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["original_currency"] == "USD"


@pytest.mark.asyncio
async def test_list_ledger_filter_by_requires_review(client, auth_headers):
    response = await client.get(
        "/api/v1/ledger?requires_review=true",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["requires_manual_review"] is True


@pytest.mark.asyncio
async def test_list_ledger_filter_sar_required(client, auth_headers):
    response = await client.get(
        "/api/v1/ledger?sar_required=true",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["sar_required"] is True


@pytest.mark.asyncio
async def test_list_ledger_invalid_page_size(client, auth_headers):
    response = await client.get(
        "/api/v1/ledger?page_size=9999",
        headers=auth_headers,
    )
    assert response.status_code == 422


# ─── POST /api/v1/ledger/scan Tests ──────────────────────────────────────────

SAMPLE_STATEMENT = """
BANK STATEMENT - FNB ZIMBABWE
Account: 62012345678
Period: 01 Nov 2024 - 30 Nov 2024
Currency: USD

Date        Description                          Amount      Balance
01/11/2024  Opening Balance                                  5,000.00
05/11/2024  TRANSFER FROM DELTA CORP             +2,500.00   7,500.00
10/11/2024  FUEL PURCHASE - PUMA ENERGY          -150.00     7,350.00
15/11/2024  SALARY PAYMENT - STAFF               -3,200.00   4,150.00
22/11/2024  ZAR CONVERSION RECEIPT               +800.00     4,950.00
28/11/2024  OFFICE SUPPLIES - DAWSONS            -95.00      4,855.00
30/11/2024  CLOSING BALANCE                                  4,855.00
"""


@pytest.mark.asyncio
async def test_scan_statement_returns_entries(client, auth_headers):
    mock_parse = LLMStatementParseResult(
        transactions=[
            ParsedTransaction(
                amount=Decimal("2500.00"),
                currency=Currency.USD,
                description="TRANSFER FROM DELTA CORP",
                counterparty_name="DELTA CORP",
                transaction_date=None,
                raw_line="05/11/2024  TRANSFER FROM DELTA CORP  +2,500.00",
            ),
            ParsedTransaction(
                amount=Decimal("150.00"),
                currency=Currency.USD,
                description="FUEL PURCHASE - PUMA ENERGY",
                counterparty_name="PUMA ENERGY",
                transaction_date=None,
                raw_line="10/11/2024  FUEL PURCHASE - PUMA ENERGY  -150.00",
            ),
            ParsedTransaction(
                amount=Decimal("3200.00"),
                currency=Currency.USD,
                description="SALARY PAYMENT - STAFF",
                transaction_date=None,
                raw_line="15/11/2024  SALARY PAYMENT - STAFF  -3,200.00",
            ),
        ],
        parse_notes="Opening and closing balance lines skipped.",
        detected_statement_currency=Currency.USD,
    )

    with (
        patch(
            "app.services.compliance_ai.StatementParserService.parse_statement",
            new=AsyncMock(return_value=mock_parse),
        ),
        patch(
            "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
            new=AsyncMock(return_value=_safe_compliance_result()),
        ),
    ):
        response = await client.post(
            "/api/v1/ledger/scan",
            headers=auth_headers,
            json={
                "raw_text": SAMPLE_STATEMENT,
                "default_currency": "USD",
                "hint_tenant_timezone": "Africa/Harare",
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["parsed_count"] == 3
    assert data["saved_count"] == 3
    assert data["failed_count"] == 0
    assert len(data["entries"]) == 3
    assert data["detected_statement_currency"] == "USD"
    assert data["parse_notes"] == "Opening and closing balance lines skipped."

    # Verify all entries are scoped to the correct tenant
    for entry in data["entries"]:
        assert entry["tenant_id"] == str(TENANT_ID)
        assert entry["is_parsed_entry"] is True
        assert entry["compliance_status"] == "SAFE"


@pytest.mark.asyncio
async def test_scan_statement_too_short_rejected(client, auth_headers):
    response = await client.post(
        "/api/v1/ledger/scan",
        headers=auth_headers,
        json={
            "raw_text": "short",  # Below min_length=10
            "default_currency": "USD",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_scan_statement_parse_failure_returns_422(client, auth_headers):
    with patch(
        "app.services.compliance_ai.StatementParserService.parse_statement",
        new=AsyncMock(side_effect=ValueError("LLM returned malformed JSON")),
    ):
        response = await client.post(
            "/api/v1/ledger/scan",
            headers=auth_headers,
            json={
                "raw_text": "This is a valid enough length text for the statement parser test.",
                "default_currency": "USD",
            },
        )
    assert response.status_code == 422


# ─── Tenant Isolation Tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_different_tenants_cannot_see_each_others_data(client):
    """Create entries for tenant A, verify tenant B sees none of them."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()

    token_a = create_access_token(uuid.uuid4(), tenant_a, "a@test.com")
    token_b = create_access_token(uuid.uuid4(), tenant_b, "b@test.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    with patch(
        "app.services.compliance_ai.ComplianceAIService.analyse_transaction",
        new=AsyncMock(return_value=_safe_compliance_result()),
    ):
        create_response = await client.post(
            "/api/v1/ledger",
            headers=headers_a,
            json={
                "amount": "1234.00",
                "original_currency": "USD",
                "description": "Tenant A private transaction",
            },
        )
    assert create_response.status_code == 201
    entry_id = create_response.json()["id"]

    # Tenant B lists their ledger — should not see tenant A's entry
    list_response = await client.get("/api/v1/ledger", headers=headers_b)
    assert list_response.status_code == 200
    ids_visible_to_b = [item["id"] for item in list_response.json()["items"]]
    assert entry_id not in ids_visible_to_b
