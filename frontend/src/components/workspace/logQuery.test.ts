import assert from 'node:assert/strict';
import test from 'node:test';
import { apiClient } from '../../lib/api';
import type { LogPage } from '../../types/task';
import { initialLogQuery, updateLogQuery } from './logQuery';

test('filter changes reset the page, page navigation preserves filters, and reset clears all filters', () => {
  const pageThree = updateLogQuery(initialLogQuery, { page: 3 });
  const failed = updateLogQuery(pageThree, { status: 'failed' });
  assert.equal(failed.page, 1);
  const searched = updateLogQuery(failed, { taskId: 7, search: 'discord failure' });
  const pageTwo = updateLogQuery(searched, { page: 2 });
  assert.deepEqual(pageTwo, { taskId: 7, status: 'failed', search: 'discord failure', page: 2 });
  assert.deepEqual(updateLogQuery(pageTwo, initialLogQuery), initialLogQuery);
});

test('logs client sends server-side filters and page and retains metrics', async () => {
  const page: LogPage = {
    data: [],
    meta: {
      page: 2,
      limit: 80,
      total: 93,
      totalPages: 2,
      metrics: { total: 93, success: 0, failed: 93, retrying: 0, avgDurationMs: 345 },
    },
  };
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify(page), { status: 200 });
  };
  try {
    const result = await apiClient.listLogs({
      taskId: 7,
      status: 'failed',
      search: 'discord failure',
      limit: 80,
      page: 2,
    });
    assert.deepEqual(urls, [
      '/api/logs?taskId=7&status=failed&search=discord+failure&limit=80&page=2',
    ]);
    assert.deepEqual(result, page);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
