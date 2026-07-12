"""
app/core/firebase.py

Initializes the Firebase Admin SDK and verifies Firebase ID tokens
issued to the fintech-web frontend after a user signs in.

This is what makes Firebase auth actually trustworthy from the backend's
perspective: instead of accepting whatever uid/email a client claims,
we cryptographically verify the token against Google's public keys
(signature, issuer, audience, expiry, and — since we pass
check_revoked=True — whether the session has been revoked).
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.core.config import settings

logger = logging.getLogger(__name__)


class FirebaseTokenError(Exception):
    """Raised when a Firebase ID token fails verification for any reason."""


@lru_cache(maxsize=1)
def _firebase_app() -> firebase_admin.App:
    """
    Lazily initializes (once per process) and returns the Firebase Admin
    App instance.

    Credential resolution order:
      1. FIREBASE_CREDENTIALS_JSON — inline service-account JSON.
      2. FIREBASE_CREDENTIALS_FILE — path to a service-account JSON file.
      3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS
         env var, or the runtime's attached service account on GCP).
    """
    if firebase_admin._apps:  # pragma: no cover — already initialised elsewhere
        return firebase_admin.get_app()

    if settings.FIREBASE_CREDENTIALS_JSON:
        try:
            info = json.loads(settings.FIREBASE_CREDENTIALS_JSON.get_secret_value())
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "FIREBASE_CREDENTIALS_JSON is not valid JSON. Paste the full "
                "service-account key file contents as a single-line string."
            ) from exc
        cred = credentials.Certificate(info)
    elif settings.FIREBASE_CREDENTIALS_FILE:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_FILE)
    else:
        # Falls back to GOOGLE_APPLICATION_CREDENTIALS or the ambient
        # service account when running on GCP infrastructure.
        cred = credentials.ApplicationDefault()

    options: dict[str, Any] | None = (
        {"projectId": settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else None
    )
    app = firebase_admin.initialize_app(cred, options)
    logger.info(
        "Firebase Admin SDK initialised (project=%s)",
        settings.FIREBASE_PROJECT_ID or "auto-detected",
    )
    return app


def verify_firebase_id_token(id_token: str) -> dict[str, Any]:
    """
    Verifies a Firebase ID token's signature, issuer, audience, expiry,
    and revocation status against Firebase/Google's public keys.

    Returns the decoded claims (includes 'uid', 'email', 'email_verified',
    'auth_time', etc.) on success.

    Raises FirebaseTokenError on any verification failure — expired,
    malformed, revoked, wrong project, or wrong signature.
    """
    try:
        app = _firebase_app()
        return firebase_auth.verify_id_token(id_token, app=app, check_revoked=True)
    except FirebaseTokenError:
        raise
    except Exception as exc:
        # firebase_admin raises several distinct exception classes
        # (ExpiredIdTokenError, RevokedIdTokenError, InvalidIdTokenError, ...);
        # we collapse them to one error type for the caller.
        raise FirebaseTokenError(str(exc)) from exc
