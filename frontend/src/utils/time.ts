export function formatCountdownMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatRelativeCountdown(
  isoDate: string | null | undefined,
  nowMs = Date.now()
): string {
  if (!isoDate) return 'Not scheduled';
  const targetMs = new Date(isoDate).getTime();
  if (Number.isNaN(targetMs)) return 'Not scheduled';

  const diffSec = Math.round((targetMs - nowMs) / 1000);
  if (diffSec <= 0) return 'Due now';
  if (diffSec < 60) return `in ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `in ${diffMin}m`;
  const hours = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (hours < 24) return remMin > 0 ? `in ${hours}h ${remMin}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `in ${days}d ${remHours}h` : `in ${days}d`;
}

export function formatRelativePast(isoDate: string | null | undefined, nowMs = Date.now()): string {
  if (!isoDate) return 'Never run';
  const targetMs = new Date(isoDate).getTime();
  if (Number.isNaN(targetMs)) return 'Never run';

  const diffSec = Math.max(0, Math.round((nowMs - targetMs) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
