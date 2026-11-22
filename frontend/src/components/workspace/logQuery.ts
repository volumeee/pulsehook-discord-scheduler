import type { ExecutionLogStatus } from '../../types/task';

export interface LogQuery {
  taskId: number | 'all';
  status: ExecutionLogStatus | 'all';
  search: string;
  page: number;
}

export const initialLogQuery: LogQuery = {
  taskId: 'all',
  status: 'all',
  search: '',
  page: 1,
};

export function updateLogQuery(current: LogQuery, changes: Partial<LogQuery>): LogQuery {
  const next = { ...current, ...changes };
  if (
    next.taskId !== current.taskId ||
    next.status !== current.status ||
    next.search !== current.search
  ) {
    next.page = 1;
  }
  return next;
}
