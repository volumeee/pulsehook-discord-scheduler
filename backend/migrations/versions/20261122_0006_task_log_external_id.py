"""Add unique external_id column to task_logs for idempotent QStash log sync.

Revision ID: 20261122_0006
Revises: 20261122_0005
Create Date: 2026-11-22 10:15:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261122_0006"
down_revision: str | None = "20261122_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("task_logs", sa.Column("external_id", sa.String(length=128), nullable=True))
    op.create_index("uq_task_logs_external_id", "task_logs", ["external_id"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_task_logs_external_id", table_name="task_logs")
    op.drop_column("task_logs", "external_id")
