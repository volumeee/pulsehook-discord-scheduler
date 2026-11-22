import { Cron } from 'croner';

export interface CronPreset {
  id: string;
  label: string;
  expression: string;
  summary: string;
}

export const CRON_PRESETS: CronPreset[] = [
  {
    id: 'every-minute',
    label: 'Every minute',
    expression: '* * * * *',
    summary: 'Runs every minute (great for quick live testing)',
  },
  {
    id: 'every-15-min',
    label: 'Every 15 min',
    expression: '*/15 * * * *',
    summary: 'Runs every 15 minutes around the clock',
  },
  {
    id: 'hourly',
    label: 'Hourly',
    expression: '0 * * * *',
    summary: 'Runs at minute 0 of every hour',
  },
  {
    id: 'daily-9am',
    label: 'Daily 09:00',
    expression: '0 9 * * *',
    summary: 'Runs every day at 09:00',
  },
  {
    id: 'weekdays-9am',
    label: 'Weekdays 09:00',
    expression: '0 9 * * 1-5',
    summary: 'Runs Monday through Friday at 09:00',
  },
  {
    id: 'weekly-mon',
    label: 'Weekly Mon',
    expression: '0 9 * * 1',
    summary: 'Runs every Monday at 09:00',
  },
];

export function isValidCronExpression(expression: string): boolean {
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }
  try {
    const job = new Cron(trimmed, { paused: true, timezone: 'UTC' });
    const next = job.nextRun();
    job.stop();
    return next !== null;
  } catch {
    return false;
  }
}

export function getNextRunDate(expression: string, fromDate?: Date): Date | null {
  if (!isValidCronExpression(expression)) {
    return null;
  }
  try {
    const job = new Cron(expression.trim(), { paused: true, timezone: 'UTC' });
    const next = job.nextRun(fromDate);
    job.stop();
    return next ?? null;
  } catch {
    return null;
  }
}

export function getUpcomingRuns(expression: string, count = 3): Date[] {
  if (!isValidCronExpression(expression)) {
    return [];
  }
  try {
    const job = new Cron(expression.trim(), { paused: true, timezone: 'UTC' });
    const runs = job.nextRuns(count);
    job.stop();
    return runs;
  } catch {
    return [];
  }
}

const WEEKDAY_NAMES: Record<string, string> = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
};

function padTwo(val: string): string {
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  return String(num).padStart(2, '0');
}

export function describeCronExpression(expression: string): string {
  const trimmed = expression.trim();
  if (!isValidCronExpression(trimmed)) {
    return 'Invalid 5-field cron expression';
  }

  const [min, hour, dom, month, dow] = trimmed.split(/\s+/);

  if (trimmed === '* * * * *') return 'Runs every minute';
  if (min.startsWith('*/') && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Runs every ${min.slice(2)} minutes`;
  }
  if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Runs every hour on the hour';
  }
  if (/^\d+$/.test(min) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `Runs every hour at minute :${padTwo(min)}`;
  }
  if (/^\d+$/.test(min) && hour.startsWith('*/') && dom === '*' && month === '*' && dow === '*') {
    return `Runs every ${hour.slice(2)} hours at :${padTwo(min)}`;
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && month === '*') {
    const timeStr = `${padTwo(hour)}:${padTwo(min)} UTC`;
    if (dow === '*') return `Runs daily at ${timeStr}`;
    if (dow === '1-5') return `Runs weekdays (Mon–Fri) at ${timeStr}`;
    if (dow === '0,6' || dow === '6,0') return `Runs weekends at ${timeStr}`;
    if (WEEKDAY_NAMES[dow]) return `Runs every ${WEEKDAY_NAMES[dow]} at ${timeStr}`;
  }
  if (
    /^\d+$/.test(min) &&
    /^\d+$/.test(hour) &&
    /^\d+$/.test(dom) &&
    month === '*' &&
    dow === '*'
  ) {
    return `Runs on day ${dom} of each month at ${padTwo(hour)}:${padTwo(min)} UTC`;
  }

  return `Custom schedule (${trimmed})`;
}

export function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 4 && segments[0] === 'api' && segments[1] === 'webhooks') {
      const id = segments[2];
      const idPreview = id.length > 6 ? `${id.slice(0, 4)}…${id.slice(-2)}` : id;
      return `${parsed.hostname}/api/webhooks/${idPreview}/••••`;
    }
    return `${parsed.hostname}/••••`;
  } catch {
    return 'Invalid webhook URL';
  }
}

export function describeRetryPolicy(maxRetry: number, retryDelayMs: number): string {
  if (maxRetry <= 0) {
    return 'Runs once with no automatic retries if delivery fails.';
  }
  const steps: string[] = [];
  for (let i = 0; i < Math.min(maxRetry, 4); i++) {
    const ms = Math.min(retryDelayMs * Math.pow(2, i), 30000);
    steps.push(ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s` : `${ms}ms`);
  }
  const suffix = maxRetry > 4 ? ' → …' : '';
  return `Retries up to ${maxRetry} ${maxRetry === 1 ? 'time' : 'times'} (${steps.join(' → ')}${suffix} backoff) before marking Failed.`;
}
