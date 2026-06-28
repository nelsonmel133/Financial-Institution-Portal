"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-29 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────────
    compliancerating = postgresql.ENUM(
        "A", "B", "C", "D", name="compliancerating", create_type=False
    )
    compliancerating.create(op.get_bind(), checkfirst=True)

    compliancestatus = postgresql.ENUM(
        "PENDING", "SAFE", "FLAGGED", "BLOCKED", "ESCALATED",
        name="compliancestatus", create_type=False,
    )
    compliancestatus.create(op.get_bind(), checkfirst=True)

    compliancecategory = postgresql.ENUM(
        "ROUTINE", "CTR", "SAR", "STRUCTURING", "HIGH_VALUE",
        "CROSS_BORDER", "THIRD_PARTY", "UNKNOWN",
        name="compliancecategory", create_type=False,
    )
    compliancecategory.create(op.get_bind(), checkfirst=True)

    currency = postgresql.ENUM(
        "USD", "ZWG", "ZAR", name="currency", create_type=False
    )
    currency.create(op.get_bind(), checkfirst=True)

    # ── tenants ────────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organisation_name", sa.String(255), nullable=False),
        sa.Column(
            "compliance_rating",
            sa.Enum("A", "B", "C", "D", name="compliancerating"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("contact_email", sa.String(320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organisation_name", name="uq_tenants_org_name"),
    )
    op.create_index(op.f("ix_tenants_id"), "tenants", ["id"], unique=False)

    # ── ledger_entries ─────────────────────────────────────────────────────────
    op.create_table(
        "ledger_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column(
            "original_currency",
            sa.Enum("USD", "ZWG", "ZAR", name="currency"),
            nullable=False,
        ),
        sa.Column("base_amount_usd", sa.Numeric(18, 4), nullable=False),
        sa.Column("exchange_rate_used", sa.Numeric(18, 8), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("counterparty_name", sa.String(512), nullable=True),
        sa.Column("counterparty_account", sa.String(64), nullable=True),
        sa.Column("reference_number", sa.String(128), nullable=True),
        sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "compliance_status",
            sa.Enum(
                "PENDING", "SAFE", "FLAGGED", "BLOCKED", "ESCALATED",
                name="compliancestatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "compliance_category",
            sa.Enum(
                "ROUTINE", "CTR", "SAR", "STRUCTURING", "HIGH_VALUE",
                "CROSS_BORDER", "THIRD_PARTY", "UNKNOWN",
                name="compliancecategory",
            ),
            nullable=False,
        ),
        sa.Column("risk_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("llm_audit_summary", sa.Text(), nullable=True),
        sa.Column("llm_flags", sa.Text(), nullable=True),
        sa.Column("requires_manual_review", sa.Boolean(), nullable=False),
        sa.Column("ctr_required", sa.Boolean(), nullable=False),
        sa.Column("sar_required", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("analysed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_raw_text", sa.Text(), nullable=True),
        sa.Column("is_parsed_entry", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ledger_entries_id"), "ledger_entries", ["id"], unique=False)
    op.create_index(op.f("ix_ledger_entries_tenant_id"), "ledger_entries", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_ledger_entries_compliance_status"), "ledger_entries", ["compliance_status"], unique=False)
    op.create_index("ix_ledger_tenant_created", "ledger_entries", ["tenant_id", "created_at"], unique=False)
    op.create_index("ix_ledger_tenant_status", "ledger_entries", ["tenant_id", "compliance_status"], unique=False)
    op.create_index("ix_ledger_compliance_category", "ledger_entries", ["compliance_category"], unique=False)


def downgrade() -> None:
    op.drop_table("ledger_entries")
    op.drop_table("tenants")

    for enum_name in ("compliancecategory", "compliancestatus", "compliancerating", "currency"):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
