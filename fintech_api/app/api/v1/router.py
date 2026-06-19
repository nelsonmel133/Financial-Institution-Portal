"""
app/api/v1/router.py

Aggregates all v1 endpoint routers under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.ledger import router as ledger_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(auth_router)
api_v1_router.include_router(ledger_router)
