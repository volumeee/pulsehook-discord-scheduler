"""Account-scoped API key management."""

from __future__ import annotations

import hashlib
import secrets
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.models.api_key import ApiKey
from app.models.user import User


def hash_api_key(raw_key: str) -> str:
    """Return hex SHA-256 hash of a raw API key."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new (raw_key, key_prefix, key_hash) tuple."""
    raw_key = f"ph_live_{secrets.token_hex(24)}"
    key_prefix = f"{raw_key[:14]}…{raw_key[-4:]}"
    return raw_key, key_prefix, hash_api_key(raw_key)


class ApiKeyService:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def list_api_keys(self, *, user_id: int) -> list[dict[str, Any]]:
        with self._session_factory() as db:
            rows = (
                db.execute(
                    select(ApiKey)
                    .where(ApiKey.user_id == user_id)
                    .order_by(desc(ApiKey.created_at))
                )
                .scalars()
                .all()
            )
            return [row.to_dict() for row in rows]

    def create_api_key(
        self, *, user_id: int, name: str, key_prefix: str, key_hash: str
    ) -> dict[str, Any]:
        with self._session_factory() as db:
            record = ApiKey(
                user_id=user_id,
                name=name,
                key_prefix=key_prefix,
                key_hash=key_hash,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            return record.to_dict()

    def bootstrap_api_key(
        self, *, user_id: int, name: str, key_prefix: str, key_hash: str
    ) -> dict[str, Any] | None:
        """Atomically create the initial API key for a specific user when none exist for that user."""
        with self._session_factory() as db:
            user_row = db.execute(
                select(User.id).where(User.id == user_id).with_for_update()
            ).scalar_one_or_none()
            if user_row is None:
                return None

            existing = db.execute(
                select(ApiKey.id).where(ApiKey.user_id == user_id).limit(1).with_for_update()
            ).scalar_one_or_none()
            if existing is not None:
                return None

            record = ApiKey(
                user_id=user_id,
                name=name,
                key_prefix=key_prefix,
                key_hash=key_hash,
            )
            db.add(record)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                return None
            db.refresh(record)
            return record.to_dict()

    def delete_api_key(self, key_id: int, *, user_id: int) -> bool:
        with self._session_factory() as db:
            record = db.execute(
                select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
            ).scalar_one_or_none()
            if record is None:
                return False
            db.delete(record)
            db.commit()
            return True
