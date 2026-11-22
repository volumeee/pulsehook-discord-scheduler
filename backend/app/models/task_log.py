"""Task Execution Log ORM model."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base, utc_now


class TaskLog(Base):
    __tablename__ = "task_logs"
    __table_args__ = (Index("ix_task_logs_task_id_execution_time", "task_id", "execution_time"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    execution_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    task = relationship("Task", back_populates="logs")

    def to_dict(self, task_name: str | None = None) -> dict[str, Any]:
        return {
            "id": self.id,
            "taskId": self.task_id,
            "taskName": task_name,
            "externalId": self.external_id,
            "executionTime": (self.execution_time.isoformat() if self.execution_time else None),
            "status": self.status,
            "retryCount": self.retry_count,
            "httpStatus": self.http_status,
            "durationMs": self.duration_ms,
            "message": self.message,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
