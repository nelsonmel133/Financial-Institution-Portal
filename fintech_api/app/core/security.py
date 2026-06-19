"""
app/core/security.py

JWT creation, validation, and FastAPI dependency for extracting
the authenticated tenant context from every inbound request.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from app.core.config import settings


# ─── Token Data Models ──────────────────────────────────────────────────────

class TokenPayload(BaseModel):
    """Claims embedded inside the JWT access token."""
    sub: str = Field(..., description="User identifier (UUID string).")
    tenant_id: str = Field(..., description="Tenant UUID this user belongs to.")
    email: str
    exp: datetime
    iat: datetime


class TenantContext(BaseModel):
    """Resolved tenant context injected into every secured endpoint."""
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    email: str

    model_config = {"arbitrary_types_allowed": True}


# ─── JWT Utilities ───────────────────────────────────────────────────────────

def create_access_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    email: str,
) -> str:
    """
    Mints a signed HS256 JWT containing the user's tenant binding.
    The token expires after JWT_ACCESS_TOKEN_EXPIRE_MINUTES minutes.
    """
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "email": email,
        "iat": now,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> TokenPayload:
    """
    Decodes and validates a JWT, raising HTTP 401 on any failure.
    Handles expiry, signature, and structural errors explicitly.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        raw_payload = jwt.decode(
            token,
            settings.JWT_SECRET.get_secret_value(),
            algorithms=[settings.JWT_ALGORITHM],
        )
        return TokenPayload(**raw_payload)

    except JWTError as exc:
        raise credentials_exception from exc
    except Exception as exc:
        # Catch Pydantic validation errors for malformed payloads
        raise credentials_exception from exc


# ─── FastAPI Security Scheme ─────────────────────────────────────────────────

_bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_tenant(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
) -> TenantContext:
    """
    FastAPI dependency — validates the Bearer token and returns the
    resolved TenantContext for use in downstream route handlers.

    Usage:
        @router.get("/resource")
        async def handler(ctx: Annotated[TenantContext, Depends(get_current_tenant)]):
            ...
    """
    payload = decode_access_token(credentials.credentials)

    try:
        user_id = uuid.UUID(payload.sub)
        tenant_id = uuid.UUID(payload.tenant_id)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token contains invalid UUID identifiers.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return TenantContext(
        user_id=user_id,
        tenant_id=tenant_id,
        email=payload.email,
    )


# ─── Type Alias for DI ───────────────────────────────────────────────────────

CurrentTenant = Annotated[TenantContext, Depends(get_current_tenant)]
