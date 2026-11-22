import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCountdownMmSs,
  formatRelativeCountdown,
  formatRelativePast,
  getTimeOfDayGreeting,
} from './time';

test('formatCountdownMmSs formats mm:ss cleanly and clamps negative values', () => {
  assert.equal(formatCountdownMmSs(300), '05:00');
  assert.equal(formatCountdownMmSs(65), '01:05');
  assert.equal(formatCountdownMmSs(-10), '00:00');
});

test('getTimeOfDayGreeting returns morning, afternoon, and evening labels', () => {
  assert.equal(getTimeOfDayGreeting(new Date('2026-11-21T08:00:00')), 'Good morning');
  assert.equal(getTimeOfDayGreeting(new Date('2026-11-21T14:30:00')), 'Good afternoon');
  assert.equal(getTimeOfDayGreeting(new Date('2026-11-21T20:15:00')), 'Good evening');
});

test('formatRelativeCountdown handles missing, due, and future timestamps', () => {
  const nowMs = Date.parse('2026-11-21T12:00:00Z');
  assert.equal(formatRelativeCountdown(null, nowMs), 'Not scheduled');
  assert.equal(formatRelativeCountdown('2026-11-21T12:00:00Z', nowMs), 'Due now');
  assert.equal(formatRelativeCountdown('2026-11-21T12:00:45Z', nowMs), 'in 45s');
  assert.equal(formatRelativeCountdown('2026-11-21T14:15:00Z', nowMs), 'in 2h 15m');
});

test('formatRelativePast handles missing, recent, and elapsed timestamps', () => {
  const nowMs = Date.parse('2026-11-21T12:00:00Z');
  assert.equal(formatRelativePast(null, nowMs), 'Never run');
  assert.equal(formatRelativePast('2026-11-21T11:59:55Z', nowMs), 'Just now');
  assert.equal(formatRelativePast('2026-11-21T11:59:15Z', nowMs), '45s ago');
  assert.equal(formatRelativePast('2026-11-20T10:00:00Z', nowMs), '1d ago');
});
