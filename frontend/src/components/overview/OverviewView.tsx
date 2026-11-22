'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Layers, Plus, Sparkles } from 'lucide-react';
import type { SessionPrincipal } from '../../lib/api';
import type { DashboardSummary, TaskRecord, TaskStatus } from '../../types/task';
import { getTimeOfDayGreeting } from '../../utils/time';
import { AnimatedNumber } from '../shared/AnimatedNumber';
import { EASE_SETTLE } from '../shared/motion';
import { OverviewDetails } from './OverviewDetails';

interface OverviewViewProps {
  principal: SessionPrincipal;
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  seeding: boolean;
  runningTaskIds: Set<number>;
  onRetryLoad: () => void;
  onCreateTask: () => void;
  onSeedSamples: () => void;
  onNavigateTasks: (statusFilter: 'all' | TaskStatus) => void;
  onNavigateLogs: (taskId?: number) => void;
  onRunNow: (task: TaskRecord) => void;
}

export function OverviewView({
  principal,
  summary,
  loading,
  error,
  seeding,
  runningTaskIds,
  onRetryLoad,
  onCreateTask,
  onSeedSamples,
  onNavigateTasks,
  onNavigateLogs,
  onRunNow,
}: OverviewViewProps) {
  const prefersReduced = useReducedMotion();
  // Subtle 15-second tick keeps relative countdowns & past timestamps fresh
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClockTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-72 animate-pulse rounded-2xl bg-white/80" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[124px] animate-pulse rounded-2xl border border-[#E6E8F0] bg-white p-5"
            >
              <div className="h-3 w-20 rounded bg-[#E6E8F0]" />
              <div className="mt-4 h-8 w-16 rounded bg-[#E6E8F0]" />
              <div className="mt-3 h-3 w-28 rounded bg-[#F1F3F8]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-2xl border border-[#E6E8F0] bg-white lg:col-span-5" />
          <div className="h-72 animate-pulse rounded-2xl border border-[#E6E8F0] bg-white lg:col-span-7" />
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-2xl border border-[#FECACA] bg-white p-6">
        <h2 className="font-display text-base font-semibold text-[#111827]">
          Unable to load dashboard summary
        </h2>
        <p className="mt-1.5 text-sm text-[#525B70]">{error}</p>
        <button
          type="button"
          onClick={onRetryLoad}
          className="mt-4 min-h-[40px] rounded-xl bg-[#5865F2] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4752C4]"
        >
          Try Again
        </button>
      </div>
    );
  }

  const data = summary ?? {
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

  const handleLabel =
    principal.displayName || (principal.username ? `@${principal.username}` : 'there');
  const greeting = getTimeOfDayGreeting();
  const healthNarrative =
    data.totalTasks === 0
      ? 'Ready to schedule your first automated Discord webhook.'
      : data.failedTasks > 0
        ? `${data.failedTasks} ${data.failedTasks === 1 ? 'schedule needs' : 'schedules need'} attention — open logs to inspect responses and re-run.`
        : data.activeTasks > 0
          ? `${data.activeTasks} active ${data.activeTasks === 1 ? 'schedule is' : 'schedules are'} armed and running smoothly on PostgreSQL.`
          : `${data.pausedTasks} draft ${data.pausedTasks === 1 ? 'task is' : 'tasks are'} paused and ready whenever you want to enable them.`;

  const kpis = [
    {
      id: 'total',
      label: 'Total Tasks',
      value: data.totalTasks,
      suffix: '',
      detail: `${data.pausedTasks} paused · ${data.activeTasks} armed`,
      tone: 'text-[#111827]',
      onClick: () => onNavigateTasks('all'),
    },
    {
      id: 'active',
      label: 'Active Schedules',
      value: data.activeTasks,
      suffix: '',
      detail: 'Running on cron engine',
      tone: 'text-[#15803D]',
      onClick: () => onNavigateTasks('active'),
    },
    {
      id: 'failed',
      label: 'Failed Tasks',
      value: data.failedTasks,
      suffix: '',
      detail: data.failedTasks > 0 ? 'Review logs & re-run' : 'All schedules healthy',
      tone: data.failedTasks > 0 ? 'text-[#DC2626]' : 'text-[#111827]',
      onClick: () => onNavigateTasks('failed'),
    },
    {
      id: 'health',
      label: 'Delivery Success',
      value: data.totalExecutions > 0 ? data.successRate : 100,
      suffix: '%',
      detail:
        data.totalExecutions > 0
          ? `${data.totalExecutions} logs · ${data.avgDurationMs} ms avg`
          : 'No dispatches logged yet',
      tone: 'text-[#5865F2]',
      onClick: () => onNavigateLogs(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Personalized Greeting Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE_SETTLE }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
            {greeting}, <span className="text-[#5865F2]">{handleLabel}</span>
          </h2>
          <p className="mt-1 text-sm text-[#525B70]">{healthNarrative}</p>
        </div>
        <div className="hidden items-center gap-3 text-xs text-[#64748B] lg:flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded-md border border-[#E6E8F0] bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#111827]">
              N
            </kbd>
            <span>New task</span>
          </span>
        </div>
      </motion.div>

      {/* KPI Bento Strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        {kpis.map((card, index) => (
          <motion.button
            key={card.id}
            type="button"
            onClick={card.onClick}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              delay: index * 0.04,
              ease: EASE_SETTLE,
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            className="group flex flex-col justify-between rounded-2xl border border-[#E6E8F0] bg-white/95 p-4 text-left backdrop-blur-[2px] transition-colors hover:border-[#C7CCDB] focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:outline-none sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#525B70]">{card.label}</span>
              <motion.span
                animate={
                  prefersReduced
                    ? undefined
                    : { x: [0, 1.5, 0], y: [0, -1.5, 0], opacity: [0.65, 1, 0.65] }
                }
                transition={{
                  duration: 2.8,
                  delay: index * 0.35,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="inline-flex will-change-transform"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-[#9CA3AF] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#5865F2]" />
              </motion.span>
            </div>
            <div className={`font-display mt-3 text-3xl font-bold tracking-tight ${card.tone}`}>
              <AnimatedNumber value={card.value} suffix={card.suffix} />
            </div>
            <p className="mt-2 truncate text-xs text-[#525B70] tabular-nums">{card.detail}</p>
          </motion.button>
        ))}
      </div>

      {/* Empty Welcome Bento when 0 tasks exist */}
      {data.totalTasks === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_SETTLE }}
          className="rounded-2xl border border-[#E6E8F0] bg-white/95 p-7 text-center backdrop-blur-[2px] sm:p-10"
        >
          <motion.div
            animate={prefersReduced ? undefined : { y: [0, -3.5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FE] text-[#5865F2] will-change-transform"
          >
            <Layers className="h-6 w-6" />
          </motion.div>
          <h2 className="font-display mt-4 text-xl font-bold text-[#111827]">
            Your schedule is clear
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#525B70]">
            Create your first Discord webhook task and preview exactly how it lands in your
            channel—or load 3 paused starter templates to explore the workflow right away.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onCreateTask}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#4752C4] sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Task</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={seeding}
              onClick={onSeedSamples}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#E6E8F0] bg-white px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-[#111827] transition-colors hover:bg-[#F6F7FB] disabled:opacity-60 sm:w-auto"
            >
              <Sparkles className="h-4 w-4 text-[#5865F2]" />
              <span>{seeding ? 'Loading templates…' : 'Load 3 Starter Templates'}</span>
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <OverviewDetails
          data={data}
          runningTaskIds={runningTaskIds}
          onNavigateTasks={onNavigateTasks}
          onNavigateLogs={onNavigateLogs}
          onRunNow={onRunNow}
        />
      )}
    </div>
  );
}
