import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeCronExpression,
  describeRetryPolicy,
  getNextRunDate,
  getUpcomingRuns,
  isValidCronExpression,
  maskWebhookUrl,
} from './cron';

test('validates standard 5-field cron expressions accurately', () => {
  assert.equal(isValidCronExpression('* * * * *'), true);
  assert.equal(isValidCronExpression('*/15 * * * *'), true);
  assert.equal(isValidCronExpression('0 9 * * 1-5'), true);
  assert.equal(isValidCronExpression('invalid-cron'), false);
  assert.equal(isValidCronExpression('0 9 * *'), false);
});

test('produces human-readable cron descriptions and upcoming run timestamps', () => {
  assert.equal(describeCronExpression('* * * * *'), 'Runs every minute');
  assert.equal(describeCronExpression('*/15 * * * *'), 'Runs every 15 minutes');
  assert.match(describeCronExpression('0 9 * * 1-5'), /09:00/);

  const runs = getUpcomingRuns('*/5 * * * *', 3);
  assert.equal(runs.length, 3);
  assert.ok(runs[1].getTime() > runs[0].getTime());
  assert.ok(runs[2].getTime() > runs[1].getTime());
});

test('evaluates schedules in UTC and renders dates in the local timezone', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const beforeDst = getNextRunDate('0 9 * * *', new Date('2026-03-07T00:00:00Z'));
    const afterDst = getNextRunDate('0 9 * * *', new Date('2026-03-08T00:00:00Z'));
    assert.equal(beforeDst?.toISOString(), '2026-03-07T09:00:00.000Z');
    assert.equal(afterDst?.toISOString(), '2026-03-08T09:00:00.000Z');

    const localTime = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    assert.equal(localTime.format(beforeDst!), '04:00');
    assert.equal(localTime.format(afterDst!), '05:00');

    const upcoming = getUpcomingRuns('0 9 * * *', 3);
    assert.equal(upcoming.length, 3);
    for (const run of upcoming) {
      assert.equal(run.getUTCHours(), 9);
      assert.equal(run.getUTCMinutes(), 0);
    }
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('uses standard Sunday numbering and either matching day field', () => {
  const base = new Date('2026-03-02T00:00:00Z');
  assert.equal(getNextRunDate('0 9 * * 0', base)?.toISOString(), '2026-03-08T09:00:00.000Z');
  assert.equal(getNextRunDate('0 9 13 * 1', base)?.toISOString(), '2026-03-02T09:00:00.000Z');
});

test('describes exponential retry policies and masks Discord webhook tokens', () => {
  assert.match(describeRetryPolicy(0, 2000), /no automatic retries/i);
  assert.match(describeRetryPolicy(3, 2000), /Retries up to 3 times/);
  assert.match(describeRetryPolicy(3, 2000), /2s → 4s → 8s/);

  const masked = maskWebhookUrl(
    'https://discord.com/api/webhooks/123456789012345678/super-secret-token-value'
  );
  assert.ok(masked.includes('discord.com/api/webhooks/'));
  assert.ok(masked.includes('••••'));
  assert.ok(!masked.includes('super-secret-token-value'));
});
