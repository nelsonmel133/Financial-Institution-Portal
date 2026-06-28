"""
app/api/v1/endpoints/tenants.py

Public tenant-management endpoints:

  GET /api/v1/tenants
    — Returns all active tenants (id, name, compliance_rating).
      Used by frontends to populate the tenant selector.
      No auth required — tenant list is not sensitive.

  GET /api/v1/tenants/{tenant_id}/dashboard
    — Returns live KPI roll-ups for the specified tenant's ledger.
      Requires a valid Bearer JWT (any tenant's token is accepted).
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.core.database import get_db
from app.core.security import CurrentTenant
from app.models.financial import ComplianceStatus, LedgerEntry, Tenant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["Tenants"])


# ─── Response models ──────────────────────────────────────────────────────────

class TenantSummary(BaseModel):
    id: uuid.UUID
    organisation_name: str
    compliance_rating: str
    is_active: bool
    model_config = {"from_attributes": True}


class TenantDashboard(BaseModel):
    tenant_id: uuid.UUID
    organisation_name: str
    total_entries: int
    flagged_entries: int
    entries_requiring_review: int
    ctr_required_count: int
    sar_required_count: int
    total_volume_usd: Decimal
    net_flow_usd: Decimal
    window_days: int


# ─── GET /api/v1/tenants ──────────────────────────────────────────────────────

@router.get(
    "",
    response_model=list[TenantSummary],
    summary="List all active tenants",
)
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TenantSummary]:
    result = await db.execute(
        select(Tenant).where(Tenant.is_active == True).order_by(Tenant.organisation_name)
    )
    tenants = list(result.scalars().all())
    return [TenantSummary.model_validate(t) for t in tenants]


# ─── GET /api/v1/tenants/{tenant_id}/dashboard ───────────────────────────────

@router.get(
    "/{tenant_id}/dashboard",
    response_model=TenantDashboard,
    summary="KPI dashboard for a specific tenant",
)
async def tenant_dashboard(
    tenant_id: uuid.UUID,
    ctx: CurrentTenant,
    db: Annotated[AsyncSession, Depends(get_db)],
    window_days: int = 7,
) -> TenantDashboard:
    # Verify tenant exists
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")

    since = datetime.now(tz=timezone.utc) - timedelta(days=window_days)

    base = [
        LedgerEntry.tenant_id == tenant_id,
        LedgerEntry.created_at >= since,
    ]

    # Total count
    total_result = await db.execute(
        select(func.count(LedgerEntry.id)).where(*base)
    )
    total_entries = total_result.scalar_one() or 0

    # Flagged
    flagged_result = await db.execute(
        select(func.count(LedgerEntry.id)).where(
            *base, LedgerEntry.compliance_status.in_(
                [ComplianceStatus.FLAGGED, ComplianceStatus.BLOCKED, ComplianceStatus.ESCALATED]
            )
        )
    )
    flagged_entries = flagged_result.scalar_one() or 0

    # Requires review
    review_result = await db.execute(
        select(func.count(LedgerEntry.id)).where(*base, LedgerEntry.requires_manual_review == True)
    )
    entries_requiring_review = review_result.scalar_one() or 0

    # CTR
    ctr_result = await db.execute(
        select(func.count(LedgerEntry.id)).where(*base, LedgerEntry.ctr_required == True)
    )
    ctr_count = ctr_result.scalar_one() or 0

    # SAR
    sar_result = await db.execute(
        select(func.count(LedgerEntry.id)).where(*base, LedgerEntry.sar_required == True)
    )
    sar_count = sar_result.scalar_one() or 0

    # Volume
    vol_result = await db.execute(
        select(func.sum(LedgerEntry.base_amount_usd)).where(*base)
    )
    total_volume = vol_result.scalar_one() or Decimal("0")

    return TenantDashboard(
        tenant_id=tenant_id,
        organisation_name=tenant.organisation_name,
        total_entries=total_entries,
        flagged_entries=flagged_entries,
        entries_requiring_review=entries_requiring_review,
        ctr_required_count=ctr_count,
        sar_required_count=sar_count,
        total_volume_usd=Decimal(str(total_volume)),
        net_flow_usd=Decimal(str(total_volume)),  # expand when debit/credit split is modelled
        window_days=window_days,
    )
