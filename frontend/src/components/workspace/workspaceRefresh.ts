import type { ApiKeyRecord, DashboardSummary, LogPage, TaskRecord } from '../../types/task';

export type WorkspaceResult<T> = { value: T; error: null } | { error: string };

export interface WorkspaceRequests {
  summary: () => Promise<DashboardSummary>;
  tasks: () => Promise<TaskRecord[]>;
  logs: () => Promise<LogPage>;
  keys: () => Promise<ApiKeyRecord[]>;
}

export interface WorkspaceRefresher {
  refresh: (silent?: boolean) => Promise<void>;
  refreshLogs: () => Promise<void>;
  dispose: () => void;
}

interface WorkspaceRefreshHandlers {
  isCurrent: () => boolean;
  onStart: (silent: boolean) => void;
  onLogsStart: () => void;
  onSummary: (result: WorkspaceResult<DashboardSummary>) => void;
  onTasks: (result: WorkspaceResult<TaskRecord[]>) => void;
  onLogs: (result: WorkspaceResult<LogPage>) => void;
  onKeys: (result: WorkspaceResult<ApiKeyRecord[]>) => void;
  onUnauthorized: (error: unknown) => boolean;
}

export function createWorkspaceRefresher(
  requests: WorkspaceRequests,
  handlers: WorkspaceRefreshHandlers
): WorkspaceRefresher {
  const generations = { summary: 0, tasks: 0, logs: 0, keys: 0 };
  let disposed = false;

  async function load<T>(
    resource: keyof typeof generations,
    request: () => Promise<T>,
    onResult: (result: WorkspaceResult<T>) => void
  ) {
    const requestGeneration = ++generations[resource];
    const isCurrent = () =>
      !disposed && generations[resource] === requestGeneration && handlers.isCurrent();
    try {
      const value = await request();
      if (isCurrent()) onResult({ value, error: null });
    } catch (error) {
      if (!isCurrent() || handlers.onUnauthorized(error)) return;
      onResult({
        error:
          error instanceof Error ? error.message : 'Could not sync workspace data from PostgreSQL.',
      });
    }
  }

  async function refresh(silent = false) {
    if (disposed || !handlers.isCurrent()) return;
    handlers.onStart(silent);
    await Promise.all([
      load('summary', requests.summary, handlers.onSummary),
      load('tasks', requests.tasks, handlers.onTasks),
      load('logs', requests.logs, handlers.onLogs),
      load('keys', requests.keys, handlers.onKeys),
    ]);
  }

  async function refreshLogs() {
    if (disposed || !handlers.isCurrent()) return;
    handlers.onLogsStart();
    await load('logs', requests.logs, handlers.onLogs);
  }

  return {
    refresh,
    refreshLogs,
    dispose() {
      disposed = true;
    },
  };
}
