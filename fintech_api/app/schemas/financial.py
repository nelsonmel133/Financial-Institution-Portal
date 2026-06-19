"""
app/schemas/financial.py

Pydantic v2 validation schemas for:
  - API request payloads
  - API response serialisation
  - LLM structured output contracts (compliance analysis and statement parsing)

All monetary fields are declared as Decimal with explicit precision constraints.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.financial import (
    ComplianceCategory,
    ComplianceRating,
    ComplianceStatus,
    Currency,
)


# ─── Shared Constraints ───────────────────────────────────────────────────────

PositiveDecimal = Annotated[Decimal, Field(gt=Decimal("0"), decimal_places=4)]
RiskScore = Annotated[Decimal, Field(ge=Decimal("0"), le=Decimal("100"), decimal_places=2)]
NonEmptyStr = Annotated[str, StringConstraints(min_length=1, max_length=4096, strip_whitespace=True)]
ShortStr = Annotated[str, StringConstraints(min_length=1, max_length=512, strip_whitespace=True)]


# ─── Tenant Schemas ───────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    organisation_name: ShortStr
    compliance_rating: ComplianceRating = ComplianceRating.B
    contact_email: str | None = Field(
        default=None,
        pattern=r"^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$",
    )


class TenantRead(BaseModel):
    id: uuid.UUID
    organisation_name: str
    compliance_rating: ComplianceRating
    is_active: bool
    contact_email: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── LedgerEntry Request Schemas ──────────────────────────────────────────────

class LedgerEntryCreate(BaseModel):
    """
    Payload for manually submitting a single structured ledger entry.
    The compliance AI analysis is triggered automatically after save.
    """
    amount: PositiveDecimal
    original_currency: Currency
    description: NonEmptyStr
    counterparty_name: str | None = Field(default=None, max_length=512)
    counterparty_account: str | None = Field(default=None, max_length=64)
    reference_number: str | None = Field(default=None, max_length=128)
    transaction_date: datetime | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: Any) -> Decimal:
        """Accept string, int, or float inputs and coerce to Decimal safely."""
        if isinstance(v, float):
            # Avoid float imprecision: round-trip through string representation
            return Decimal(str(v))
        return Decimal(str(v))


class StatementScanRequest(BaseModel):
    """
    Payload for the /scan endpoint — accepts raw bank statement text.
    The LLM parser extracts individual transactions from the free-form input.
    """
    raw_text: Annotated[str, StringConstraints(min_length=10, max_length=32_000, strip_whitespace=True)]
    default_currency: Currency = Currency.USD
    hint_tenant_timezone: str | None = Field(
        default=None,
        description="IANA timezone string (e.g. 'Africa/Harare') to resolve ambiguous dates.",
        max_length=64,
    )


# ─── LedgerEntry Response Schemas ────────────────────────────────────────────

class LedgerEntryRead(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    amount: Decimal
    original_currency: Currency
    base_amount_usd: Decimal
    exchange_rate_used: Decimal | None
    description: str
    counterparty_name: str | None
    counterparty_account: str | None
    reference_number: str | None
    transaction_date: datetime | None
    compliance_status: ComplianceStatus
    compliance_category: ComplianceCategory
    risk_score: Decimal | None
    llm_audit_summary: str | None
    llm_flags: list[str] | None = None
    requires_manual_review: bool
    ctr_required: bool
    sar_required: bool
    is_parsed_entry: bool
    created_at: datetime
    updated_at: datetime
    analysed_at: datetime | None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def deserialise_flags(self) -> "LedgerEntryRead":
        """Convert the JSON-string stored in llm_flags back to a Python list."""
        if self.llm_flags is None:
            return self
        if isinstance(self.llm_flags, str):
            try:
                self.llm_flags = json.loads(self.llm_flags)
            except (json.JSONDecodeError, ValueError):
                self.llm_flags = [self.llm_flags]
        return self


class PaginatedLedgerResponse(BaseModel):
    """Paginated wrapper for the GET /ledger endpoint."""
    items: list[LedgerEntryRead]
    total: int
    page: int
    page_size: int
    total_pages: int
    tenant_id: uuid.UUID


# ─── LLM Structured Output Contracts ─────────────────────────────────────────

class ComplianceFlag(BaseModel):
    """A single risk flag raised by the LLM compliance analyser."""
    code: str = Field(
        ...,
        description="Machine-readable flag code (e.g. 'STRUCTURING_ATTEMPT', 'PEP_MATCH').",
        max_length=64,
    )
    severity: Annotated[str, StringConstraints(pattern=r"^(LOW|MEDIUM|HIGH|CRITICAL)$")]
    description: str = Field(
        ...,
        description="Human-readable explanation of why this flag was raised.",
        max_length=1024,
    )
    regulatory_basis: str | None = Field(
        default=None,
        description="Applicable statute or regulation (e.g. 'FATF Recommendation 16').",
        max_length=256,
    )


class LLMComplianceResult(BaseModel):
    """
    Structured output contract for the compliance AI pipeline.
    The LLM is instructed to return a JSON object matching this exact schema.
    """
    compliance_status: ComplianceStatus = Field(
        ...,
        description="Overall compliance verdict for this transaction.",
    )
    compliance_category: ComplianceCategory = Field(
        ...,
        description="Primary regulatory classification.",
    )
    risk_score: RiskScore = Field(
        ...,
        description=(
            "Composite risk score 0–100. "
            "0–25: Low, 26–50: Moderate, 51–75: High, 76–100: Critical."
        ),
    )
    flags: list[ComplianceFlag] = Field(
        default_factory=list,
        description="Specific risk flags identified in the transaction.",
    )
    requires_manual_review: bool = Field(
        ...,
        description="True if a compliance officer must manually review this entry.",
    )
    ctr_required: bool = Field(
        ...,
        description="True if a Currency Transaction Report must be filed.",
    )
    sar_required: bool = Field(
        ...,
        description="True if a Suspicious Activity Report must be filed.",
    )
    audit_summary: str = Field(
        ...,
        description=(
            "Concise narrative (max 500 chars) explaining the compliance assessment "
            "and any actions required."
        ),
        max_length=500,
    )
    detected_patterns: list[str] = Field(
        default_factory=list,
        description="AML/CFT pattern names detected (e.g. 'smurfing', 'round-tripping').",
    )

    @field_validator("risk_score", mode="before")
    @classmethod
    def coerce_risk_score(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class ParsedTransaction(BaseModel):
    """
    A single transaction extracted by the LLM statement parser.
    The LLM returns a list of these from unstructured bank statement text.
    """
    amount: PositiveDecimal
    currency: Currency
    description: NonEmptyStr
    counterparty_name: str | None = None
    counterparty_account: str | None = None
    reference_number: str | None = None
    transaction_date: datetime | None = None
    raw_line: str | None = Field(
        default=None,
        description="The original text line this transaction was extracted from.",
    )

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: Any) -> Decimal:
        return Decimal(str(v))


class LLMStatementParseResult(BaseModel):
    """
    Structured output from the LLM statement parser.
    The LLM returns this as a top-level JSON object.
    """
    transactions: list[ParsedTransaction] = Field(
        ...,
        description="All transactions successfully extracted from the input text.",
        min_length=1,
    )
    parse_notes: str | None = Field(
        default=None,
        description="Optional notes from the parser about ambiguities or skipped lines.",
        max_length=2048,
    )
    detected_statement_currency: Currency | None = Field(
        default=None,
        description="Primary currency inferred from the statement header or majority of entries.",
    )


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class TokenRequest(BaseModel):
    """Simplified credential exchange — for demo/testing only."""
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    email: str = Field(pattern=r"^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$")


# ─── Scan Response ────────────────────────────────────────────────────────────

class StatementScanResponse(BaseModel):
    """Response returned by the POST /scan endpoint."""
    parsed_count: int
    saved_count: int
    failed_count: int
    entries: list[LedgerEntryRead]
    parse_notes: str | None
    detected_statement_currency: Currency | None
