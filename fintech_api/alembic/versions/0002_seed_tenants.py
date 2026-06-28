"""seed tenants

Revision ID: 0002_seed_tenants
Revises: 0001_initial_schema
Create Date: 2026-06-29 00:01:00.000000

Creates the three branch tenants with stable UUIDs that match the
hardcoded TENANT_IDS in the frontend configuration.
"""
from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = "0002_seed_tenants"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

# These UUIDs are the canonical IDs used in JWT tokens and frontend config.
# Do NOT change them after initial deployment.
TENANTS = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "organisation_name": "Main Retail Hub",
        "compliance_rating": "A",
        "is_active": True,
        "contact_email": "main@tendai.co.zw",
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "organisation_name": "Harare Sub-Branch",
        "compliance_rating": "B",
        "is_active": True,
        "contact_email": "harare@tendai.co.zw",
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "organisation_name": "Bulawayo Branch",
        "compliance_rating": "B",
        "is_active": True,
        "contact_email": "bulawayo@tendai.co.zw",
    },
]


def upgrade() -> None:
    now = datetime.now(tz=timezone.utc)
    tenants_table = sa.table(
        "tenants",
        sa.column("id"),
        sa.column("organisation_name"),
        sa.column("compliance_rating"),
        sa.column("is_active"),
        sa.column("contact_email"),
        sa.column("created_at"),
        sa.column("updated_at"),
    )
    op.bulk_insert(
        tenants_table,
        [
            {**t, "created_at": now, "updated_at": now}
            for t in TENANTS
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM tenants WHERE id IN ("
        "'11111111-1111-1111-1111-111111111111',"
        "'22222222-2222-2222-2222-222222222222',"
        "'33333333-3333-3333-3333-333333333333'"
        ")"
    )
