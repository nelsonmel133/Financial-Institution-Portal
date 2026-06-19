"""
app/core/database.py

Async SQLAlchemy engine, session factory, and base declarative class.
Designed for Alembic migration compatibility.
"""

from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Shared declarative base — all ORM models inherit from this."""
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,          # Recycle stale connections proactively
    echo=settings.DB_ECHO_SQL,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,      # Safe for async: avoids lazy-load after commit
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a per-request async database session
    and guarantees rollback on exception plus close on exit.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_all_tables() -> None:
    """
    Development utility — creates all tables from ORM metadata.
    In production, use Alembic migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables() -> None:
    """Drops all tables. Dangerous — test/CI environments only."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
