'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/api';
import type { ApiKeyRecord, DashboardSummary, LogPage, TaskRecord } from '../../types/task';
import { initialLogQuery, updateLogQuery, type LogQuery } from './logQuery';
import {
  createWorkspaceRefresher,
  type WorkspaceRefresher,
  type WorkspaceResult,
} from './workspaceRefresh';

interface Resource<T> {
  value: T;
  loading: boolean;
  error: string | null;
}

interface WorkspaceData {
  summary: Resource<DashboardSummary | null>;
  tasks: Resource<TaskRecord[]>;
  logs: Resource<LogPage | null>;
  keys: Resource<ApiKeyRecord[]>;
}

const initialData: WorkspaceData = {
  summary: { value: null, loading: true, error: null },
  tasks: { value: [], loading: true, error: null },
  logs: { value: null, loading: true, error: null },
  keys: { value: [], loading: true, error: null },
};

function applyResult<T>(resource: Resource<T>, result: WorkspaceResult<T>): Resource<T> {
  return {
    value: result.error === null ? result.value : resource.value,
    loading: false,
    error: result.error,
  };
}

export function useWorkspaceData(
  isCurrent: () => boolean,
  handleUnauthorized: (error: unknown) => boolean
) {
  const [data, setData] = useState(initialData);
  const [logQuery, setLogQuery] = useState(initialLogQuery);
  const logQueryRef = useRef(logQuery);
  const refresher = useRef<WorkspaceRefresher | null>(null);
  const searchTimerRef = useRef<number | null>(null);

  const refreshWorkspace = useCallback(async (silent = false) => {
    await refresher.current?.refresh(silent);
  }, []);

  const changeLogQuery = useCallback((changes: Partial<LogQuery>) => {
    const previous = logQueryRef.current;
    const next = updateLogQuery(previous, changes);
    if (
      next.taskId === previous.taskId &&
      next.status === previous.status &&
      next.search === previous.search &&
      next.page === previous.page
    )
      return;
    const searchOnly =
      next.search !== previous.search &&
      next.taskId === previous.taskId &&
      next.status === previous.status;
    logQueryRef.current = next;
    setLogQuery(next);
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (searchOnly) {
      searchTimerRef.current = window.setTimeout(() => {
        searchTimerRef.current = null;
        void refresher.current?.refreshLogs();
      }, 220);
    } else {
      void refresher.current?.refreshLogs();
    }
  }, []);

  useEffect(() => {
    const currentRefresher = createWorkspaceRefresher(
      {
        summary: apiClient.getDashboardSummary,
        tasks: apiClient.listTasks,
        logs: () => {
          const query = logQueryRef.current;
          return apiClient.listLogs({
            taskId: query.taskId === 'all' ? undefined : query.taskId,
            status: query.status,
            search: query.search,
            page: query.page,
            limit: 80,
          });
        },
        keys: apiClient.listApiKeys,
      },
      {
        isCurrent,
        onUnauthorized: handleUnauthorized,
        onStart: (silent) => {
          if (silent) return;
          setData((previous) => ({
            summary: { ...previous.summary, loading: true },
            tasks: { ...previous.tasks, loading: true },
            logs: { ...previous.logs, loading: true },
            keys: { ...previous.keys, loading: true },
          }));
        },
        onLogsStart: () => {
          setData((previous) => ({
            ...previous,
            logs: { ...previous.logs, loading: true, error: null },
          }));
        },
        onSummary: (result) =>
          setData((previous) => ({
            ...previous,
            summary: applyResult(previous.summary, result),
          })),
        onTasks: (result) =>
          setData((previous) => ({
            ...previous,
            tasks: applyResult(previous.tasks, result),
          })),
        onLogs: (result) => {
          if (result.error === null && result.value.meta.page !== logQueryRef.current.page) {
            const next = { ...logQueryRef.current, page: result.value.meta.page };
            logQueryRef.current = next;
            setLogQuery(next);
          }
          setData((previous) => ({
            ...previous,
            logs: applyResult(previous.logs, result),
          }));
        },
        onKeys: (result) =>
          setData((previous) => ({
            ...previous,
            keys: applyResult(previous.keys, result),
          })),
      }
    );
    refresher.current = currentRefresher;
    void currentRefresher.refresh();
    const interval = window.setInterval(() => {
      void currentRefresher.refresh(true);
    }, 30000);
    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      window.clearInterval(interval);
      currentRefresher.dispose();
      if (refresher.current === currentRefresher) refresher.current = null;
    };
  }, [handleUnauthorized, isCurrent]);

  return { data, logQuery, changeLogQuery, refreshWorkspace };
}
