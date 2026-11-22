'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw, Search, ScrollText, X } from 'lucide-react';
import type { ExecutionLogStatus, LogMetrics, TaskLogRecord, TaskRecord } from '../../types/task';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { EASE_SETTLE, SPRING_SNAPPY } from '../shared/motion';
import { LogEntry } from './LogEntry';

type LogStatusFilter = 'all' | ExecutionLogStatus;

interface LogsViewProps {
  logs: TaskLogRecord[];
  tasks: TaskRecord[];
  selectedTaskId: number | 'all';
  onSelectedTaskIdChange: (id: number | 'all') => void;
  statusFilter: LogStatusFilter;
  onStatusFilterChange: (status: LogStatusFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onResetFilters: () => void;
  metrics: LogMetrics;
  loading: boolean;
  error: string | null;
  runningTaskIds: Set<number>;
  onRefresh: () => void;
  onRerunTask: (taskId: number) => void;
}

const LOG_TABS: { id: LogStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'success', label: 'Success' },
  { id: 'retrying', label: 'Retrying' },
  { id: 'failed', label: 'Failed' },
];

export function LogsView({
  logs,
  tasks,
  selectedTaskId,
  onSelectedTaskIdChange,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  page,
  totalPages,
  onPageChange,
  onResetFilters,
  metrics,
  loading,
  error,
  runningTaskIds,
  onRefresh,
  onRerunTask,
}: LogsViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const terminal = metrics.success + metrics.failed;
  const successRate = terminal > 0 ? Math.round((metrics.success / terminal) * 100) : 100;
  const hasFilters = selectedTaskId !== 'all' || statusFilter !== 'all' || search.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Compact Performance Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Matching Logs',
            value: metrics.total,
            suffix: '',
            tone: 'text-[#111827]',
          },
          {
            label: 'Success Rate',
            value: successRate,
            suffix: '%',
            tone: 'text-[#15803D]',
          },
          {
            label: 'Avg Latency',
            value: Math.round(metrics.avgDurationMs),
            suffix: ' ms',
            tone: 'text-[#111827]',
          },
          {
            label: 'Retry Events',
            value: metrics.retrying,
            suffix: '',
            tone: 'text-[#B45309]',
          },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: idx * 0.04,
              ease: EASE_SETTLE,
            }}
            className="rounded-2xl border border-[#E6E8F0] bg-white p-4"
          >
            <span className="text-xs font-medium text-[#525B70]">{item.label}</span>
            <div className={`font-display mt-1.5 text-2xl font-bold ${item.tone}`}>
              <AnimatedNumber value={item.value} suffix={item.suffix} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E6E8F0] bg-white p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:flex-1">
          <select
            value={selectedTaskId === 'all' ? 'all' : String(selectedTaskId)}
            onChange={(e) =>
              onSelectedTaskIdChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            aria-label="Filter logs by task"
            className="min-h-[42px] rounded-xl border border-[#E6E8F0] bg-[#FAFBFD] px-3 text-xs font-semibold text-[#111827] focus:border-[#5865F2] focus:bg-white focus:outline-none sm:w-52"
          >
            <option value="all">All Tasks</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter by message or HTTP code…"
              aria-label="Search execution logs"
              className="min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-[#FAFBFD] py-2 pr-9 pl-10 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:bg-white focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
            />
            <AnimatePresence>
              {search.length > 0 && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.14 }}
                  onClick={() => onSearchChange('')}
                  aria-label="Clear log search"
                  className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#EEF0F6] hover:text-[#111827]"
                >
                  <X className="h-3.5 w-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 lg:justify-end">
          <div
            role="group"
            aria-label="Filter logs by status"
            className="grid flex-1 grid-cols-4 gap-1 rounded-xl bg-[#F6F7FB] p-1 sm:inline-flex sm:flex-none"
          >
            {LOG_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatusFilterChange(tab.id)}
                  className={`relative min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    active ? 'text-[#111827]' : 'text-[#525B70]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="logStatusFilter"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            aria-label="Refresh execution logs"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#E6E8F0] bg-white text-[#111827] transition-colors hover:bg-[#F6F7FB]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-[#5865F2]' : ''}`} />
          </motion.button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* Empty State */}
      {loading && logs.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E8F0] bg-white p-8 text-center text-sm text-[#525B70]">
          Loading execution logs…
        </div>
      ) : error && logs.length === 0 ? null : logs.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E8F0] bg-white p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6F7FB] text-[#525B70]">
            <ScrollText className="h-5 w-5" />
          </div>
          <h3 className="font-display mt-3.5 text-base font-semibold text-[#111827]">
            No execution logs to display
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#525B70]">
            {hasFilters
              ? 'No log entries match your current task or status filters.'
              : 'Trigger any task with Run Now or wait for an active cron window to inspect delivery status, latency, and retry traces here.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-4 min-h-[40px] rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#111827] transition-colors hover:bg-[#F6F7FB]"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[#EEF0F6] overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <LogEntry
                key={log.id}
                log={log}
                expanded={expandedId === log.id}
                isRunning={runningTaskIds.has(log.taskId)}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                onRerunTask={onRerunTask}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Execution log pages" className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="min-h-[40px] rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#111827] transition-colors hover:bg-[#F6F7FB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs font-medium text-[#525B70] tabular-nums" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="min-h-[40px] rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#111827] transition-colors hover:bg-[#F6F7FB] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
