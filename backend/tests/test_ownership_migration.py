"""Ownership migration preserves legacy data and refuses ambiguous backfills."""

from __future__ import annotations

from importlib import import_module

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

migration = import_module("migrations.versions.20261122_0004_resource_ownership")


def _legacy_schema(connection):
    metadata = sa.MetaData()
    users = sa.Table(
        "users",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("is_email_verified", sa.Boolean, nullable=False),
    )
    tasks = sa.Table(
        "tasks",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("webhook_url", sa.String, nullable=False),
    )
    api_keys = sa.Table(
        "api_keys",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key_hash", sa.String, nullable=False),
    )
    task_logs = sa.Table(
        "task_logs",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("task_id", sa.Integer, sa.ForeignKey("tasks.id", ondelete="CASCADE")),
        sa.Column("message", sa.String, nullable=False),
    )
    metadata.create_all(connection)
    return users, tasks, api_keys, task_logs


def _apply(connection, function):
    with Operations.context(MigrationContext.configure(connection)):
        function()


def test_backfill_and_downgrade_preserve_tasks_keys_and_logs():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        users, tasks, api_keys, task_logs = _legacy_schema(connection)
        connection.execute(
            users.insert(),
            [
                {"id": 3, "is_email_verified": True},
                {"id": 4, "is_email_verified": False},
            ],
        )
        connection.execute(
            tasks.insert(), {"id": 10, "name": "Existing", "webhook_url": "secret-url"}
        )
        connection.execute(api_keys.insert(), {"id": 20, "key_hash": "existing-hash"})
        connection.execute(task_logs.insert(), {"id": 30, "task_id": 10, "message": "existing log"})

        _apply(connection, migration.upgrade)
        assert connection.execute(
            sa.text("SELECT user_id, name, webhook_url FROM tasks")
        ).one() == (3, "Existing", "secret-url")
        assert connection.execute(sa.text("SELECT user_id, key_hash FROM api_keys")).one() == (
            3,
            "existing-hash",
        )
        assert connection.execute(sa.text("SELECT task_id, message FROM task_logs")).one() == (
            10,
            "existing log",
        )
        inspector = sa.inspect(connection)
        for table in ("tasks", "api_keys"):
            columns = {column["name"]: column for column in inspector.get_columns(table)}
            assert columns["user_id"]["nullable"] is False
            assert any(
                fk["referred_table"] == "users" and fk["constrained_columns"] == ["user_id"]
                for fk in inspector.get_foreign_keys(table)
            )

        _apply(connection, migration.downgrade)
        assert connection.execute(sa.text("SELECT name, webhook_url FROM tasks")).one() == (
            "Existing",
            "secret-url",
        )
        assert (
            connection.execute(sa.text("SELECT key_hash FROM api_keys")).scalar_one()
            == "existing-hash"
        )
        assert connection.execute(sa.text("SELECT task_id, message FROM task_logs")).one() == (
            10,
            "existing log",
        )
        for table in ("tasks", "api_keys"):
            assert "user_id" not in {
                column["name"] for column in sa.inspect(connection).get_columns(table)
            }


@pytest.mark.parametrize(
    "verified_users,resource", [(0, "task"), (0, "key"), (2, "task"), (2, "key")]
)
def test_ambiguous_existing_records_fail_before_schema_changes(verified_users, resource):
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        users, tasks, api_keys, _ = _legacy_schema(connection)
        for user_id in range(1, verified_users + 1):
            connection.execute(users.insert(), {"id": user_id, "is_email_verified": True})
        if resource == "task":
            connection.execute(
                tasks.insert(), {"id": 1, "name": "Existing", "webhook_url": "secret-url"}
            )
        else:
            connection.execute(api_keys.insert(), {"id": 1, "key_hash": "existing-hash"})

        with pytest.raises(RuntimeError, match="exactly one verified user"):
            _apply(connection, migration.upgrade)
        for table in ("tasks", "api_keys"):
            assert "user_id" not in {
                column["name"] for column in sa.inspect(connection).get_columns(table)
            }
        table = tasks if resource == "task" else api_keys
        assert connection.execute(sa.select(sa.func.count()).select_from(table)).scalar_one() == 1


def test_empty_resources_upgrade_even_with_multiple_users():
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        users, _, _, _ = _legacy_schema(connection)
        connection.execute(
            users.insert(),
            [
                {"id": 1, "is_email_verified": True},
                {"id": 2, "is_email_verified": True},
            ],
        )
        _apply(connection, migration.upgrade)
        connection.execute(
            sa.text(
                "INSERT INTO tasks (id, name, webhook_url, user_id) VALUES (1, 'New', 'url', 2)"
            )
        )
        assert connection.execute(sa.text("SELECT user_id FROM tasks")).scalar_one() == 2


def test_sqlite_foreign_key_enforcement_cannot_delete_existing_logs():
    engine = sa.create_engine("sqlite://")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys = ON")
        users, tasks, _, task_logs = _legacy_schema(connection)
        connection.execute(users.insert(), {"id": 1, "is_email_verified": True})
        connection.execute(
            tasks.insert(), {"id": 10, "name": "Existing", "webhook_url": "secret-url"}
        )
        connection.execute(task_logs.insert(), {"id": 30, "task_id": 10, "message": "existing log"})
        with pytest.raises(RuntimeError, match="SQLite foreign keys enabled"):
            _apply(connection, migration.upgrade)
        assert connection.execute(sa.select(task_logs.c.message)).scalar_one() == "existing log"
        assert "user_id" not in {
            column["name"] for column in sa.inspect(connection).get_columns("tasks")
        }
