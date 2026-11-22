'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Clock, Play } from 'lucide-react';
import type { DashboardSummary, TaskRecord, TaskStatus } from '../../types/task';
import { describeCronExpression } from '../../utils/cron';
import { formatRelativeCountdown, formatRelativePast } from '../../utils/time';
import { LogStatusLabel } from '../logs/LogStatusLabel';

interface OverviewDetailsProps {
  data: DashboardSummary;
  runningTaskIds: Set<number>;
  onNavigateTasks: (statusFilter: 'all' | TaskStatus) => void;
  onNavigateLogs: (taskId?: number) => void;
  onRunNow: (task: TaskRecord) => void;
}

export function OverviewDetails({
  data,
  runningTaskIds,
  onNavigateTasks,
  onNavigateLogs,
  onRunNow,
}: OverviewDetailsProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Upcoming Dispatches */}
      <section className="flex flex-col rounded-2xl border border-[#E6E8F0] bg-white/95 backdrop-blur-[2px] lg:col-span-5">
        <div className="flex items-center justify-between border-b border-[#E6E8F0] px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#111827]">
              Upcoming Dispatches
            </h2>
            <p className="mt-0.5 text-xs text-[#525B70]">
              Next active schedules armed in the cron engine
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTasks('active')}
            className="text-xs font-semibold whitespace-nowrap text-[#5865F2] hover:text-[#4752C4]"
          >
            View all
          </button>
        </div>

        {data.upcomingTasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <motion.span
              animate={prefersReduced ? undefined : { scale: [1, 1.09, 1], y: [0, -2.5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex will-change-transform"
            >
              <Clock className="h-6 w-6 text-[#9CA3AF]" />
            </motion.span>
            <p className="mt-2.5 text-sm font-medium text-[#111827]">No active schedules armed</p>
            <p className="mt-1 text-xs text-[#525B70]">
              Resume a paused task or create an active one to see live countdowns here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EEF0F6]">
            {data.upcomingTasks.map((task) => {
              const isRunning = runningTaskIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[#FAFBFD]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#111827]">{task.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#525B70]">
                      <span className="font-mono text-[#111827] tabular-nums">
                        {formatRelativeCountdown(task.nextRunAt)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{describeCronExpression(task.schedule)}</span>
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    disabled={isRunning}
                    onClick={() => onRunNow(task)}
                    aria-label={`Run ${task.name} now`}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-[#E6E8F0] bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#111827] transition-colors hover:border-[#5865F2] hover:text-[#5865F2] disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    <span>{isRunning ? 'Running…' : 'Run Now'}</span>
                  </motion.button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Execution Activity */}
      <section className="flex flex-col rounded-2xl border border-[#E6E8F0] bg-white/95 backdrop-blur-[2px] lg:col-span-7">
        <div className="flex items-center justify-between border-b border-[#E6E8F0] px-5 py-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[#111827]">
              Recent Execution Activity
            </h2>
            <p className="mt-0.5 text-xs text-[#525B70]">
              Latest Discord webhook dispatches and retry traces
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateLogs()}
            className="text-xs font-semibold whitespace-nowrap text-[#5865F2] hover:text-[#4752C4]"
          >
            Open logs
          </button>
        </div>

        {data.recentLogs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-medium text-[#111827]">No dispatches recorded yet</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#525B70]">
              Hit <span className="font-semibold text-[#111827]">Run Now</span> on any task to test
              your Discord webhook and see delivery latency and retry traces appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EEF0F6]">
            {data.recentLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => onNavigateLogs(log.taskId)}
                className="flex w-full items-start justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#FAFBFD]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="truncate font-semibold text-[#111827]">
                      {log.taskName || `Task #${log.taskId}`}
                    </span>
                    <span aria-hidden="true" className="text-[#9CA3AF]">
                      ·
                    </span>
                    <LogStatusLabel status={log.status} />
                    {log.retryCount > 0 && (
                      <>
                        <span aria-hidden="true" className="text-[#9CA3AF]">
                          ·
                        </span>
                        <span className="font-mono text-[#525B70] tabular-nums">
                          Retry {log.retryCount}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-[#525B70]">{log.message}</p>
                </div>
                <div className="shrink-0 text-right font-mono text-xs text-[#525B70] tabular-nums">
                  <div>{log.httpStatus ? `HTTP ${log.httpStatus}` : 'Network'}</div>
                  <div className="mt-0.5 text-[11px] text-[#9CA3AF]">
                    {log.durationMs}ms · {formatRelativePast(log.executionTime)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
