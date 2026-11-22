"""Account-scoped audit logs and dashboard summaries."""

from __future__ import annotations

from typing import Any

from sqlalchemy import String, case, cast, desc, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.models.task import Task
from app.models.task_log import TaskLog
from app.services.task_service import TaskService


class LogService:
    def __init__(self, session_factory: sessionmaker[Session], task_service: TaskService) -> None:
        self._session_factory = session_factory
        self._task_service = task_service

    @staticmethod
    def _query(
        *,
        user_id: int,
        task_id: int | None = None,
        status: str | None = None,
        search: str | None = None,
    ):
        stmt = (
            select(TaskLog, Task.name)
            .join(Task, TaskLog.task_id == Task.id)
            .where(Task.user_id == user_id)
        )
        if task_id is not None:
            stmt = stmt.where(TaskLog.task_id == task_id)
        if status and status != "all":
            stmt = stmt.where(TaskLog.status == status)
        if search and search.strip():
            term = search.strip()
            stmt = stmt.where(
                TaskLog.message.icontains(term, autoescape=True)
                | Task.name.icontains(term, autoescape=True)
                | cast(TaskLog.http_status, String).contains(term, autoescape=True)
            )
        return stmt

    def list_logs(
        self,
        *,
        user_id: int,
        task_id: int | None = None,
        status: str | None = None,
        search: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        stmt = self._query(user_id=user_id, task_id=task_id, status=status, search=search)
        stmt = stmt.order_by(desc(TaskLog.execution_time), desc(TaskLog.id)).limit(
            max(1, min(250, limit))
        )
        with self._session_factory() as db:
            return [log.to_dict(task_name=name) for log, name in db.execute(stmt).all()]

    def query_logs(
        self,
        *,
        user_id: int,
        task_id: int | None = None,
        status: str | None = None,
        search: str | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> dict[str, Any]:
        limit = max(1, min(250, limit))
        stmt = self._query(user_id=user_id, task_id=task_id, status=status, search=search)
        metrics_stmt = stmt.with_only_columns(
            func.count(TaskLog.id),
            func.coalesce(func.sum(case((TaskLog.status == "success", 1), else_=0)), 0),
            func.coalesce(func.sum(case((TaskLog.status == "failed", 1), else_=0)), 0),
            func.coalesce(func.sum(case((TaskLog.status == "retrying", 1), else_=0)), 0),
            func.coalesce(func.avg(TaskLog.duration_ms), 0),
        )
        with self._session_factory() as db:
            total, success, failed, retrying, avg_ms = db.execute(metrics_stmt).one()
            total_pages = max(1, (total + limit - 1) // limit)
            page = max(1, min(page, total_pages))
            rows_stmt = (
                stmt.order_by(desc(TaskLog.execution_time), desc(TaskLog.id))
                .limit(limit)
                .offset((page - 1) * limit)
            )
            rows = db.execute(rows_stmt).all()
        return {
            "data": [log.to_dict(task_name=name) for log, name in rows],
            "meta": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": total_pages,
                "metrics": {
                    "total": total,
                    "success": success,
                    "failed": failed,
                    "retrying": retrying,
                    "avgDurationMs": int(float(avg_ms) + 0.5),
                },
            },
        }

    def get_dashboard_summary(self, *, user_id: int) -> dict[str, Any]:
        tasks = self._task_service.list_tasks(user_id=user_id)
        recent_logs = self.list_logs(user_id=user_id, limit=8)

        total_tasks = len(tasks)
        active_tasks = sum(1 for t in tasks if t["status"] == "active")
        paused_tasks = sum(1 for t in tasks if t["status"] == "paused")
        failed_tasks = sum(1 for t in tasks if t["status"] == "failed")

        with self._session_factory() as db:
            stats_rows = db.execute(
                select(
                    TaskLog.status,
                    func.count(TaskLog.id),
                    func.coalesce(func.avg(TaskLog.duration_ms), 0),
                )
                .join(Task, TaskLog.task_id == Task.id)
                .where(Task.user_id == user_id)
                .group_by(TaskLog.status)
            ).all()

        total_executions = 0
        successful_executions = 0
        failed_executions = 0
        weighted_duration = 0.0

        for log_status, count_val, avg_val in stats_rows:
            cnt = int(count_val or 0)
            avg_ms = float(avg_val or 0)
            total_executions += cnt
            weighted_duration += cnt * avg_ms
            if log_status == "success":
                successful_executions += cnt
            elif log_status == "failed":
                failed_executions += cnt

        terminal = successful_executions + failed_executions
        success_rate = round((successful_executions / terminal) * 100) if terminal > 0 else 100
        avg_duration_ms = round(weighted_duration / total_executions) if total_executions > 0 else 0

        upcoming_tasks = sorted(
            [t for t in tasks if t["status"] == "active" and t["nextRunAt"]],
            key=lambda t: t["nextRunAt"],
        )[:5]

        return {
            "totalTasks": total_tasks,
            "activeTasks": active_tasks,
            "pausedTasks": paused_tasks,
            "failedTasks": failed_tasks,
            "totalExecutions": total_executions,
            "successfulExecutions": successful_executions,
            "failedExecutions": failed_executions,
            "successRate": success_rate,
            "avgDurationMs": avg_duration_ms,
            "upcomingTasks": upcoming_tasks,
            "recentLogs": recent_logs,
        }
