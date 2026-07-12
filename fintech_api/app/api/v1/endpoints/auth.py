"""
app/api/v1/endpoints/auth.py

Two token-issuance paths:

  POST /auth/token
    — Dev/testing convenience. Mints a JWT for a client-supplied
      user_id/tenant_id/email with no verification at all. Disabled
      outside of ENVIRONMENT=development.

  POST /auth/firebase-token
    — Production path. The frontend authenticates the user with Firebase
      Auth, then sends us the resulting Firebase ID token. We verify that
      token server-side (signature, issuer, audience, expiry, revocation)
      and only then mint a tenant-scoped backend JWT — using the verified
      uid/email, not anything the client asserts.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.firebase import FirebaseTokenError, verify_firebase_id_token
from app.core.security import create_access_token
from app.models.financial import Tenant
from app.schemas.financial import FirebaseTokenRequest, TokenRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Issue a JWT access token (dev/testing only)",
    description=(
        "Issues a signed JWT for the provided user_id / tenant_id pair. "
        "This endpoint is a development convenience. In production, tokens "
        "should be issued exclusively by your identity provider."
    ),
)
async def issue_token(payload: TokenRequest) -> TokenResponse:
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found.",
        )

    token = create_access_token(
        user_id=payload.user_id,
        tenant_id=payload.tenant_id,
        email=payload.email,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    )


@router.post(
    "/firebase-token",
    response_model=TokenResponse,
    summary="Exchange a verified Firebase ID token for a tenant-scoped backend JWT",
    description=(
        "Verifies the caller's Firebase ID token server-side — signature, issuer, "
        "audience, expiry, and revocation — against Firebase's public keys. On "
        "success, mints a backend JWT bound to the requested tenant using the "
        "verified uid/email. This is the auth path fintech-web uses after a user "
        "signs in with Firebase; the client never gets to assert its own identity."
    ),
)
async def issue_token_from_firebase(
    payload: FirebaseTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    try:
        claims = verify_firebase_id_token(payload.id_token)
    except FirebaseTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Firebase ID token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token has no email claim.",
        )

    firebase_uid: str = claims["uid"]
    # Firebase UIDs are opaque strings, not UUIDs, but every downstream model
    # (LedgerEntry.tenant_id lookups, TokenPayload.sub, etc.) is typed as
    # uuid.UUID. Deterministically derive one so the same Firebase user always
    # maps to the same backend user_id without needing a users table.
    user_id = uuid.uuid5(uuid.NAMESPACE_URL, f"firebase-uid:{firebase_uid}")

    tenant = await db.get(Tenant, payload.tenant_id)
    if tenant is None or not tenant.is_active:
        # NOTE: this confirms the tenant exists and is active, but does not
        # check that this particular user is a *member* of it — there's no
        # user-tenant membership table yet. Any authenticated Firebase user
        # can request a token for any active tenant_id. Add a membership
        # table + check here before relying on this for real tenant isolation.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unknown or inactive tenant.",
        )

    token = create_access_token(
        user_id=user_id,
        tenant_id=tenant.id,
        email=email,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    )
