"""
app/api/v1/endpoints/auth.py

Token issuance endpoint for development and integration testing.
In production, replace with your organisation's identity provider (IdP) integration.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.security import create_access_token
from app.schemas.financial import TokenRequest, TokenResponse
from app.core.config import settings

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
