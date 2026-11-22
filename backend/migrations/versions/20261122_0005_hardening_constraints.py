"""Harden session family IDs, add task_logs composite index, and cascade user deletions.

Revision ID: 20261122_0005
Revises: 20261122_0004
Create Date: 2026-11-22 08:40:00
"""

from __future__ import annotations

import secrets
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261122_0005"
down_revision: str | None = "20261122_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()

    # 1. Replace shared legacy_family placeholder with unique per-session family IDs
    if not op.get_context().as_sql:
        user_sessions = sa.table(
            "user_sessions",
            sa.column("id", sa.Integer()),
            sa.column("family_id", sa.String(length=64)),
        )
        legacy_ids = (
            connection.execute(
                sa.select(user_sessions.c.id).where(user_sessions.c.family_id == "legacy_family")
            )
            .scalars()
            .all()
        )
        for session_id in legacy_ids:
            connection.execute(
                user_sessions.update()
                .where(user_sessions.c.id == session_id)
                .values(family_id=secrets.token_hex(16))
            )

    # 2. Composite index for paginated task log queries ordered by execution_time
    op.create_index(
        "ix_task_logs_task_id_execution_time",
        "task_logs",
        ["task_id", "execution_time"],
        unique=False,
    )

    # 3. Ensure deleting a user cascades cleanly to owned tasks and API keys
    if connection.dialect.name == "postgresql":
        for table_name in ("tasks", "api_keys"):
            fk_name = f"fk_{table_name}_user_id_users"
            op.drop_constraint(fk_name, table_name, type_="foreignkey")
            op.create_foreign_key(
                fk_name,
                table_name,
                "users",
                ["user_id"],
                ["id"],
                ondelete="CASCADE",
            )


def downgrade() -> None:
    connection = op.get_bind()

    if connection.dialect.name == "postgresql":
        for table_name in ("api_keys", "tasks"):
            fk_name = f"fk_{table_name}_user_id_users"
            op.drop_constraint(fk_name, table_name, type_="foreignkey")
            op.create_foreign_key(
                fk_name,
                table_name,
                "users",
                ["user_id"],
                ["id"],
            )

    op.drop_index("ix_task_logs_task_id_execution_time", table_name="task_logs")
