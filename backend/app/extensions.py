"""Database engine, session factory, declarative Base, and shared UTC clock helpers."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def utc_now() -> datetime:
    """Return the current timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def ensure_utc(dt: datetime) -> datetime:
    """Normalize a naive or aware datetime to timezone-aware UTC."""
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 declarative base for all ORM models."""


def create_db_engine(database_url: str) -> Engine:
    """Create a pooled SQLAlchemy engine tailored to PostgreSQL or SQLite test DBs."""
    is_sqlite = database_url.startswith("sqlite")
    kwargs: dict[str, object] = {
        "pool_pre_ping": True,
    }
    if not is_sqlite:
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
        kwargs["pool_recycle"] = 1800

    engine = create_engine(database_url, **kwargs)

    if is_sqlite:

        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Return a configured SQLAlchemy session factory."""
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
