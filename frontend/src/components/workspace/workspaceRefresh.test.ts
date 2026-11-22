import assert from 'node:assert/strict';
import test from 'node:test';
import type { DashboardSummary, LogPage } from '../../types/task';
import { createWorkspaceRefresher } from './workspaceRefresh';

const summary: DashboardSummary = {
  totalTasks: 0,
  activeTasks: 0,
  pausedTasks: 0,
  failedTasks: 0,
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  successRate: 100,
  avgDurationMs: 0,
  upcomingTasks: [],
  recentLogs: [],
};

const logPage: LogPage = {
  data: [],
  meta: {
    page: 1,
    limit: 80,
    total: 0,
    totalPages: 1,
    metrics: { total: 0, success: 0, failed: 0, retrying: 0, avgDurationMs: 0 },
  },
};

test('refresh publishes each result independently when another endpoint fails or stalls', async () => {
  const pendingLogs = Promise.withResolvers<LogPage>();
  const received: string[] = [];
  const refresh = createWorkspaceRefresher(
    {
      summary: async () => {
        throw new Error('summary unavailable');
      },
      tasks: async () => [],
      logs: () => pendingLogs.promise,
      keys: async () => [],
    },
    {
      isCurrent: () => true,
      onStart: () => received.push('start'),
      onLogsStart: () => received.push('logs:start'),
      onSummary: (result) => received.push(`summary:${result.error}`),
      onTasks: (result) => received.push(`tasks:${result.error ?? 'ok'}`),
      onLogs: (result) => received.push(`logs:${result.error ?? 'ok'}`),
      onKeys: (result) => received.push(`keys:${result.error ?? 'ok'}`),
      onUnauthorized: () => false,
    }
  );

  const pendingRefresh = refresh.refresh();
  await Promise.resolve();
  assert.deepEqual(received, ['start', 'summary:summary unavailable', 'tasks:ok', 'keys:ok']);
  pendingLogs.resolve(logPage);
  await pendingRefresh;
  assert.deepEqual(received, [
    'start',
    'summary:summary unavailable',
    'tasks:ok',
    'keys:ok',
    'logs:ok',
  ]);
});

test('newer refresh suppresses older data and stale unauthorized errors', async () => {
  const oldSummary = Promise.withResolvers<DashboardSummary>();
  let summaryCalls = 0;
  let unauthorizedCalls = 0;
  const results: number[] = [];
  const refresh = createWorkspaceRefresher(
    {
      summary: () =>
        ++summaryCalls === 1 ? oldSummary.promise : Promise.resolve({ ...summary, totalTasks: 2 }),
      tasks: async () => [],
      logs: async () => logPage,
      keys: async () => [],
    },
    {
      isCurrent: () => true,
      onStart: () => {},
      onLogsStart: () => {},
      onSummary: (result) => {
        if (result.error === null) results.push(result.value.totalTasks);
      },
      onTasks: () => {},
      onLogs: () => {},
      onKeys: () => {},
      onUnauthorized: () => {
        unauthorizedCalls += 1;
        return true;
      },
    }
  );

  const older = refresh.refresh();
  await refresh.refresh(true);
  oldSummary.reject(new Error('expired previous request'));
  await older;
  assert.deepEqual(results, [2]);
  assert.equal(unauthorizedCalls, 0);
});

test('account transitions and disposal prevent pending responses from changing state', async () => {
  for (const transition of ['account', 'unmount'] as const) {
    const pendingSummary = Promise.withResolvers<DashboardSummary>();
    let current = true;
    const results: string[] = [];
    const refresh = createWorkspaceRefresher(
      {
        summary: () => pendingSummary.promise,
        tasks: async () => [],
        logs: async () => logPage,
        keys: async () => [],
      },
      {
        isCurrent: () => current,
        onStart: () => {},
        onLogsStart: () => {},
        onSummary: () => results.push('summary'),
        onTasks: () => {},
        onLogs: () => {},
        onKeys: () => {},
        onUnauthorized: () => {
          results.push('unauthorized');
          return true;
        },
      }
    );

    const pending = refresh.refresh();
    if (transition === 'account') current = false;
    else refresh.dispose();
    pendingSummary.reject(new Error('old session'));
    await pending;
    assert.deepEqual(results, []);
  }
});

test('changing the log query discards older log results without canceling other resources', async () => {
  const oldLogs = Promise.withResolvers<LogPage>();
  const events: string[] = [];
  let logRequests = 0;
  const refresher = createWorkspaceRefresher(
    {
      summary: async () => summary,
      tasks: async () => [],
      logs: () =>
        ++logRequests === 1
          ? oldLogs.promise
          : Promise.resolve({ ...logPage, meta: { ...logPage.meta, page: 2 } }),
      keys: async () => [],
    },
    {
      isCurrent: () => true,
      onStart: () => {},
      onLogsStart: () => events.push('logs loading'),
      onSummary: () => events.push('summary'),
      onTasks: () => events.push('tasks'),
      onLogs: (result) => {
        if (result.error === null) events.push(`logs page ${result.value.meta.page}`);
      },
      onKeys: () => events.push('keys'),
      onUnauthorized: () => false,
    }
  );

  const original = refresher.refresh();
  await refresher.refreshLogs();
  oldLogs.resolve(logPage);
  await original;
  assert.deepEqual(events, ['logs loading', 'summary', 'tasks', 'keys', 'logs page 2']);
});
