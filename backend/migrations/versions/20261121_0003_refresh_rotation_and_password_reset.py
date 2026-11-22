"""Add refresh token rotation columns to user_sessions and password_reset_tokens table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20261121_0003"
down_revision = "20261121_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_sessions",
        sa.Column(
            "family_id",
            sa.String(length=64),
            nullable=False,
            server_default="legacy_family",
        ),
    )
    op.add_column(
        "user_sessions",
        sa.Column("replaced_by_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_user_sessions_family_id", "user_sessions", ["family_id"])
    op.create_foreign_key(
        "fk_user_sessions_replaced_by_id",
        "user_sessions",
        "user_sessions",
        ["replaced_by_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("requested_ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_password_reset_tokens_token_hash"),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index(
        "ix_password_reset_tokens_token_hash",
        "password_reset_tokens",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
    op.drop_constraint("fk_user_sessions_replaced_by_id", "user_sessions", type_="foreignkey")
    op.drop_index("ix_user_sessions_family_id", table_name="user_sessions")
    op.drop_column("user_sessions", "replaced_by_id")
    op.drop_column("user_sessions", "family_id")
