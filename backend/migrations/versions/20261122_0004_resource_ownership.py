"""Assign tasks and API keys to verified accounts without guessing ownership."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20261122_0004"
down_revision = "20261121_0003"
branch_labels = None
depends_on = None


def _protect_sqlite_logs(connection) -> None:
    if connection.dialect.name != "sqlite":
        return
    foreign_keys_enabled = connection.exec_driver_sql("PRAGMA foreign_keys").scalar()
    has_logs = connection.execute(sa.text("SELECT 1 FROM task_logs LIMIT 1")).first()
    if foreign_keys_enabled and has_logs:
        raise RuntimeError(
            "Cannot rebuild tasks with SQLite foreign keys enabled while task logs exist; "
            "disable foreign keys before the migration transaction and retry."
        )


def upgrade() -> None:
    if op.get_context().as_sql:
        raise RuntimeError("Resource ownership migration requires an online database connection.")

    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        op.execute("LOCK TABLE users, tasks, api_keys IN SHARE ROW EXCLUSIVE MODE")
    elif connection.dialect.name == "sqlite":
        connection.exec_driver_sql("UPDATE users SET id = id WHERE 0")
    _protect_sqlite_logs(connection)

    tasks = sa.table("tasks", sa.column("user_id", sa.Integer()))
    api_keys = sa.table("api_keys", sa.column("user_id", sa.Integer()))
    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("is_email_verified", sa.Boolean()),
    )
    has_tasks = connection.execute(sa.select(sa.literal(1)).select_from(tasks).limit(1)).first()
    has_keys = connection.execute(sa.select(sa.literal(1)).select_from(api_keys).limit(1)).first()
    owner_id = None
    if has_tasks or has_keys:
        owners = (
            connection.execute(
                sa.select(users.c.id).where(users.c.is_email_verified.is_(True)).limit(2)
            )
            .scalars()
            .all()
        )
        if len(owners) != 1:
            raise RuntimeError(
                "Cannot assign existing tasks and API keys: exactly one verified user is "
                "required. Resolve ownership explicitly before running this migration."
            )
        owner_id = owners[0]

    for table_name in ("tasks", "api_keys"):
        op.add_column(table_name, sa.Column("user_id", sa.Integer(), nullable=True))
    if owner_id is not None:
        connection.execute(tasks.update().values(user_id=owner_id))
        connection.execute(api_keys.update().values(user_id=owner_id))

    for table_name in ("tasks", "api_keys"):
        with op.batch_alter_table(table_name) as batch:
            batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
            batch.create_foreign_key(f"fk_{table_name}_user_id_users", "users", ["user_id"], ["id"])
            batch.create_index(f"ix_{table_name}_user_id", ["user_id"])


def downgrade() -> None:
    if not op.get_context().as_sql:
        connection = op.get_bind()
        if connection.dialect.name == "sqlite":
            connection.exec_driver_sql("UPDATE users SET id = id WHERE 0")
        _protect_sqlite_logs(connection)
    for table_name in ("api_keys", "tasks"):
        with op.batch_alter_table(table_name) as batch:
            batch.drop_index(f"ix_{table_name}_user_id")
            batch.drop_constraint(f"fk_{table_name}_user_id_users", type_="foreignkey")
            batch.drop_column("user_id")
