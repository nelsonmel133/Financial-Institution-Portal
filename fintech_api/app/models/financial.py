"""
app/models/financial.py

SQLAlchemy ORM models for the Multi-Tenant Financial Reporting Platform.
All monetary columns use Numeric(18, 4) — never Float — to guarantee
decimal precision required by financial regulators.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ─── Enumerations ────────────────────────────────────────────────────────────

class Currency(str, PyEnum):
    USD = "USD"
    ZWG = "ZWG"
    ZAR = "ZAR"


class ComplianceStatus(str, PyEnum):
    PENDING = "PENDING"       # Awaiting LLM analysis
    SAFE = "SAFE"             # LLM cleared — no risk signals detected
    FLAGGED = "FLAGGED"       # Requires human review (high risk score)
    BLOCKED = "BLOCKED"       # Automatic hold — threshold breach confirmed
    ESCALATED = "ESCALATED"   # Forwarded to compliance officer


class ComplianceCategory(str, PyEnum):
    ROUTINE = "ROUTINE"                     # Normal retail/business transaction
    CTR = "CTR"                             # Currency Transaction Report required
    SAR = "SAR"                             # Suspicious Activity Report required
    STRUCTURING = "STRUCTURING"             # Detected sub-threshold structuring
    HIGH_VALUE = "HIGH_VALUE"               # Large-value above internal threshold
    CROSS_BORDER = "CROSS_BORDER"           # International transfer
    THIRD_PARTY = "THIRD_PARTY"             # Unverified third-party payee
    UNKNOWN = "UNKNOWN"                     # Could not be categorised


class ComplianceRating(str, PyEnum):
    """Tenant-level AML compliance maturity rating."""
    A = "A"   # Fully compliant, automated monitoring active
    B = "B"   # Mostly compliant, minor gaps
    C = "C"   # Partial compliance, remediation required
    D = "D"   # Non-compliant, regulatory review pending


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _new_uuid() -> uuid.UUID:
    return uuid.uuid4()


# ─── ORM Models ──────────────────────────────────────────────────────────────

class Tenant(Base):
    """
    Represents an organisation onboarded to the platform.
    Every LedgerEntry is scoped to exactly one Tenant.
    """
    __tablename__ = "tenants"
    __table_args__ = (
        UniqueConstraint("organisation_name", name="uq_tenants_org_name"),
        {"schema": None},  # Default public schema; override for schema-per-tenant setups
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=_new_uuid,
        index=True,
    )
    organisation_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    compliance_rating: Mapped[ComplianceRating] = mapped_column(
        Enum(ComplianceRating, name="compliancerating"),
        nullable=False,
        default=ComplianceRating.B,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    contact_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    # Relationships
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(
        "LedgerEntry",
        back_populates="tenant",
        cascade="all, delete-orphan",
        lazy="noload",  # Always use explicit joins in async context
    )

    def __repr__(self) -> str:
        return f"<Tenant id={self.id} org={self.organisation_name!r}>"


class LedgerEntry(Base):
    """
    Immutable financial transaction record with multi-currency metadata,
    base-currency normalisation, and LLM-generated compliance audit data.

    Design Notes:
    - `amount` stores the value as submitted in `original_currency`.
    - `base_amount_usd` stores the USD-equivalent at time of recording.
    - `compliance_status` is set to PENDING on creation and updated by the
      compliance AI service asynchronously (or inline depending on config).
    """
    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index("ix_ledger_tenant_created", "tenant_id", "created_at"),
        Index("ix_ledger_tenant_status", "tenant_id", "compliance_status"),
        Index("ix_ledger_compliance_category", "compliance_category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=_new_uuid,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Amount & Currency ────────────────────────────────────────────────────
    amount: Mapped[object] = mapped_column(
        Numeric(18, 4),
        nullable=False,
        comment="Transaction value in original_currency.",
    )
    original_currency: Mapped[Currency] = mapped_column(
        Enum(Currency, name="currency"),
        nullable=False,
    )
    base_amount_usd: Mapped[object] = mapped_column(
        Numeric(18, 4),
        nullable=False,
        comment="USD-normalised equivalent at time of recording.",
    )
    exchange_rate_used: Mapped[object] = mapped_column(
        Numeric(18, 8),
        nullable=True,
        comment="The exchange rate applied during conversion (original → USD).",
    )

    # ── Transaction Metadata ─────────────────────────────────────────────────
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Original unstructured transaction description text.",
    )
    counterparty_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    counterparty_account: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    transaction_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Compliance & Audit ───────────────────────────────────────────────────
    compliance_status: Mapped[ComplianceStatus] = mapped_column(
        Enum(ComplianceStatus, name="compliancestatus"),
        nullable=False,
        default=ComplianceStatus.PENDING,
        index=True,
    )
    compliance_category: Mapped[ComplianceCategory] = mapped_column(
        Enum(ComplianceCategory, name="compliancecategory"),
        nullable=False,
        default=ComplianceCategory.UNKNOWN,
    )
    risk_score: Mapped[object | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
        comment="LLM-assigned risk score 0.00–100.00.",
    )
    llm_audit_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Human-readable LLM compliance narrative.",
    )
    llm_flags: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON array of specific risk flags raised by the LLM.",
    )
    requires_manual_review: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    ctr_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True if a Currency Transaction Report must be filed.",
    )
    sar_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True if a Suspicious Activity Report must be filed.",
    )

    # ── Audit Timestamps ─────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
    analysed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the LLM compliance analysis completed.",
    )

    # ── Source Tracking ──────────────────────────────────────────────────────
    source_raw_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Original unstructured bank statement line (for parsed entries).",
    )
    is_parsed_entry: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
        comment="True if this entry was extracted by the statement parser endpoint.",
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship(
        "Tenant", back_populates="ledger_entries", lazy="noload"
    )

    def __repr__(self) -> str:
        return (
            f"<LedgerEntry id={self.id} "
            f"amount={self.amount} {self.original_currency} "
            f"status={self.compliance_status}>"
        )
