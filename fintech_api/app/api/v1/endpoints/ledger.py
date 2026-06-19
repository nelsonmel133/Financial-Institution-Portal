"""
app/api/v1/endpoints/ledger.py

Secure FastAPI router exposing the core ledger API:

  POST /api/v1/ledger/scan
    — Accepts raw bank statement text, runs the LLM parser,
      triggers compliance analysis per transaction, persists to PostgreSQL,
      and returns structured results.

  POST /api/v1/ledger
    — Manually submits a single structured ledger entry, triggers compliance
      analysis, and persists to PostgreSQL.

  GET  /api/v1/ledger
    — Returns a paginated, tenant-isolated multi-currency transaction log
      with optional filtering by compliance status and currency.

All endpoints require a valid Bearer JWT containing the caller's tenant_id.
Every database query is filtered by tenant_id — no cross-tenant data leakage
is possible at the ORM layer.
"""

from __future__ import annotations

import json
import logging
import math
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentTenant, TenantContext
from app.models.financial import ComplianceStatus, Currency, LedgerEntry
from app.schemas.financial import (
    LedgerEntryCreate,
    LedgerEntryRead,
    PaginatedLedgerResponse,
    StatementScanRequest,
    StatementScanResponse,
)
from app.services.compliance_ai import (
    compliance_ai_service,
    statement_parser_service,
)
from app.services.currency_service import currency_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ledger", tags=["Ledger"])


# ─── Helper: Build LedgerEntry from compliance result ────────────────────────

async def _create_ledger_entry_with_compliance(
    *,
    db: AsyncSession,
    tenant_id: uuid.UUID,
    amount: Decimal,
    original_currency: Currency,
    description: str,
    counterparty_name: str | None = None,
    counterparty_account: str | None = None,
    reference_number: str | None = None,
    transaction_date: datetime | None = None,
    source_raw_text: str | None = None,
    is_parsed_entry: bool = False,
) -> LedgerEntry:
    """
    Core business logic unit:
    1. Converts the amount to USD base equivalent.
    2. Calls the LLM compliance service.
    3. Persists the LedgerEntry to the database.
    4. Returns the ORM object (not yet refreshed — caller handles commit).
    """
    # Step 1: Currency conversion
    conversion = currency_service.convert_to_usd(amount, original_currency)

    # Step 2: LLM Compliance Analysis
    compliance = await compliance_ai_service.analyse_transaction(
        amount=amount,
        original_currency=original_currency,
        base_amount_usd=conversion.base_amount_usd,
        description=description,
        counterparty_name=counterparty_name,
        counterparty_account=counterparty_account,
        reference_number=reference_number,
    )

    # Step 3: Serialise flag list to JSON string for storage
    flags_json: str | None = None
    if compliance.flags:
        flags_json = json.dumps(
            [f.model_dump() for f in compliance.flags],
            default=str,
        )

    # Step 4: Build ORM model
    entry = LedgerEntry(
        tenant_id=tenant_id,
        amount=amount,
        original_currency=original_currency,
        base_amount_usd=conversion.base_amount_usd,
        exchange_rate_used=conversion.rate_applied,
        description=description,
        counterparty_name=counterparty_name,
        counterparty_account=counterparty_account,
        reference_number=reference_number,
        transaction_date=transaction_date,
        compliance_status=compliance.compliance_status,
        compliance_category=compliance.compliance_category,
        risk_score=compliance.risk_score,
        llm_audit_summary=compliance.audit_summary,
        llm_flags=flags_json,
        requires_manual_review=compliance.requires_manual_review,
        ctr_required=compliance.ctr_required,
        sar_required=compliance.sar_required,
        source_raw_text=source_raw_text,
        is_parsed_entry=is_parsed_entry,
        analysed_at=datetime.now(tz=timezone.utc),
    )

    db.add(entry)
    return entry


# ─── POST /api/v1/ledger/scan ────────────────────────────────────────────────

@router.post(
    "/scan",
    response_model=StatementScanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Parse raw bank statement text and save extracted transactions",
    description=(
        "Accepts unstructured or semi-structured bank statement text. "
        "The LLM statement parser extracts individual transactions, which are then "
        "individually analysed by the compliance AI and saved to the tenant's ledger."
    ),
)
async def scan_statement(
    payload: StatementScanRequest,
    ctx: CurrentTenant,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StatementScanResponse:
    """
    POST /api/v1/ledger/scan

    Workflow:
    1. Validate JWT → extract tenant_id.
    2. Send raw_text to LLM statement parser → extract ParsedTransaction list.
    3. For each parsed transaction:
       a. Convert currency to USD base.
       b. Run LLM compliance analysis.
       c. Persist LedgerEntry.
    4. Commit all entries atomically.
    5. Return structured summary with all saved entries.
    """
    logger.info(
        "POST /scan | tenant=%s chars=%d",
        ctx.tenant_id,
        len(payload.raw_text),
    )

    # ── Step 1: Parse the statement ──────────────────────────────────────────
    try:
        parse_result = await statement_parser_service.parse_statement(
            raw_text=payload.raw_text,
            default_currency=payload.default_currency,
            hint_timezone=payload.hint_tenant_timezone,
        )
    except ValueError as exc:
        logger.error("Statement parse failed for tenant=%s: %s", ctx.tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Statement parsing failed: {exc}",
        ) from exc

    if not parse_result.transactions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The LLM parser could not extract any transactions from the provided text.",
        )

    # ── Step 2: Process each parsed transaction ──────────────────────────────
    saved_entries: list[LedgerEntry] = []
    failed_count = 0

    for tx in parse_result.transactions:
        try:
            entry = await _create_ledger_entry_with_compliance(
                db=db,
                tenant_id=ctx.tenant_id,
                amount=tx.amount,
                original_currency=tx.currency,
                description=tx.description,
                counterparty_name=tx.counterparty_name,
                counterparty_account=tx.counterparty_account,
                reference_number=tx.reference_number,
                transaction_date=tx.transaction_date,
                source_raw_text=tx.raw_line,
                is_parsed_entry=True,
            )
            saved_entries.append(entry)

        except Exception as exc:
            logger.warning(
                "Failed to process parsed transaction [desc=%r]: %s",
                tx.description[:80],
                exc,
            )
            failed_count += 1
            continue

    if not saved_entries:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"All {len(parse_result.transactions)} parsed transactions failed "
                "during compliance analysis or persistence."
            ),
        )

    # ── Step 3: Flush to get DB-generated IDs, then commit ──────────────────
    try:
        await db.flush()
        # Refresh each entry to pick up server-set defaults (id, created_at, etc.)
        for entry in saved_entries:
            await db.refresh(entry)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("DB commit failed for /scan | tenant=%s: %s", ctx.tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error: failed to persist ledger entries.",
        ) from exc

    logger.info(
        "POST /scan complete | tenant=%s saved=%d failed=%d",
        ctx.tenant_id,
        len(saved_entries),
        failed_count,
    )

    return StatementScanResponse(
        parsed_count=len(parse_result.transactions),
        saved_count=len(saved_entries),
        failed_count=failed_count,
        entries=[LedgerEntryRead.model_validate(e) for e in saved_entries],
        parse_notes=parse_result.parse_notes,
        detected_statement_currency=parse_result.detected_statement_currency,
    )


# ─── POST /api/v1/ledger ─────────────────────────────────────────────────────

@router.post(
    "",
    response_model=LedgerEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a single structured ledger entry",
    description=(
        "Manually submit a structured transaction. The system converts the amount "
        "to USD base, runs LLM compliance analysis, and persists the enriched record."
    ),
)
async def create_ledger_entry(
    payload: LedgerEntryCreate,
    ctx: CurrentTenant,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LedgerEntryRead:
    """
    POST /api/v1/ledger

    Accepts a validated LedgerEntryCreate payload, runs currency conversion
    and compliance analysis, and saves the enriched entry.
    """
    logger.info(
        "POST /ledger | tenant=%s amount=%s %s",
        ctx.tenant_id,
        payload.amount,
        payload.original_currency,
    )

    try:
        entry = await _create_ledger_entry_with_compliance(
            db=db,
            tenant_id=ctx.tenant_id,
            amount=payload.amount,
            original_currency=payload.original_currency,
            description=payload.description,
            counterparty_name=payload.counterparty_name,
            counterparty_account=payload.counterparty_account,
            reference_number=payload.reference_number,
            transaction_date=payload.transaction_date,
            is_parsed_entry=False,
        )
        await db.flush()
        await db.refresh(entry)
        await db.commit()

    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error(
            "POST /ledger failed | tenant=%s: %s", ctx.tenant_id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ledger entry: {exc}",
        ) from exc

    logger.info(
        "POST /ledger complete | tenant=%s entry_id=%s status=%s",
        ctx.tenant_id,
        entry.id,
        entry.compliance_status,
    )

    return LedgerEntryRead.model_validate(entry)


# ─── GET /api/v1/ledger ──────────────────────────────────────────────────────

@router.get(
    "",
    response_model=PaginatedLedgerResponse,
    summary="List paginated ledger entries for the authenticated tenant",
    description=(
        "Returns a paginated, tenant-isolated transaction log. "
        "Supports optional filtering by compliance status and currency. "
        "Results are ordered by creation date, most recent first."
    ),
)
async def list_ledger_entries(
    ctx: CurrentTenant,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Page number (1-indexed).")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=200, description="Number of entries per page.")
    ] = 25,
    compliance_status: Annotated[
        ComplianceStatus | None,
        Query(description="Filter by compliance status."),
    ] = None,
    currency: Annotated[
        Currency | None,
        Query(description="Filter by original transaction currency."),
    ] = None,
    requires_review: Annotated[
        bool | None,
        Query(description="If true, returns only entries requiring manual review."),
    ] = None,
    ctr_required: Annotated[
        bool | None,
        Query(description="If true, returns only entries requiring a CTR filing."),
    ] = None,
    sar_required: Annotated[
        bool | None,
        Query(description="If true, returns only entries requiring a SAR filing."),
    ] = None,
) -> PaginatedLedgerResponse:
    """
    GET /api/v1/ledger

    All queries are strictly scoped to ctx.tenant_id — cross-tenant isolation
    is enforced at the ORM level, not just the application level.
    """
    logger.debug(
        "GET /ledger | tenant=%s page=%d size=%d status=%s currency=%s",
        ctx.tenant_id,
        page,
        page_size,
        compliance_status,
        currency,
    )

    # ── Build base query (tenant-scoped) ──────────────────────────────────────
    base_filter = LedgerEntry.tenant_id == ctx.tenant_id

    filters = [base_filter]

    if compliance_status is not None:
        filters.append(LedgerEntry.compliance_status == compliance_status)

    if currency is not None:
        filters.append(LedgerEntry.original_currency == currency)

    if requires_review is not None:
        filters.append(LedgerEntry.requires_manual_review == requires_review)

    if ctr_required is not None:
        filters.append(LedgerEntry.ctr_required == ctr_required)

    if sar_required is not None:
        filters.append(LedgerEntry.sar_required == sar_required)

    # ── Count query ───────────────────────────────────────────────────────────
    try:
        count_result = await db.execute(
            select(func.count(LedgerEntry.id)).where(*filters)
        )
        total: int = count_result.scalar_one()
    except Exception as exc:
        logger.error("GET /ledger count query failed | tenant=%s: %s", ctx.tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve ledger entry count.",
        ) from exc

    # ── Data query (paginated) ────────────────────────────────────────────────
    offset = (page - 1) * page_size

    try:
        data_result = await db.execute(
            select(LedgerEntry)
            .where(*filters)
            .order_by(LedgerEntry.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        entries: list[LedgerEntry] = list(data_result.scalars().all())
    except Exception as exc:
        logger.error("GET /ledger data query failed | tenant=%s: %s", ctx.tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve ledger entries.",
        ) from exc

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedLedgerResponse(
        items=[LedgerEntryRead.model_validate(e) for e in entries],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        tenant_id=ctx.tenant_id,
    )
