'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Search, Sparkles, X } from 'lucide-react';
import type { TaskRecord, TaskStatus } from '../../types/task';
import { describeCronExpression } from '../../utils/cron';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { SPRING_SNAPPY } from '../shared/motion';
import { TaskList } from './TaskList';

export type TaskStatusFilter = 'all' | TaskStatus;
type SortKey = 'updated' | 'nextRun' | 'name';

interface TasksViewProps {
  tasks: TaskRecord[];
  loading: boolean;
  error: string | null;
  statusFilter: TaskStatusFilter;
  onStatusFilterChange: (next: TaskStatusFilter) => void;
  runningTaskIds: Set<number>;
  recentRunFeedback: Record<number, 'success' | 'failed'>;
  togglingTaskIds: Set<number>;
  seeding: boolean;
  onRetryLoad: () => void;
  onCreateTask: () => void;
  onEditTask: (task: TaskRecord) => void;
  onDuplicateTask: (task: TaskRecord) => void;
  onDeleteTask: (task: TaskRecord) => Promise<void>;
  onToggleStatus: (task: TaskRecord) => void;
  onRunNow: (task: TaskRecord) => void;
  onViewLogs: (taskId: number) => void;
  onSeedSamples: () => void;
}

const STATUS_TABS: { id: TaskStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'failed', label: 'Failed' },
];

export function TasksView({
  tasks,
  loading,
  error,
  statusFilter,
  onStatusFilterChange,
  runningTaskIds,
  recentRunFeedback,
  togglingTaskIds,
  seeding,
  onRetryLoad,
  onCreateTask,
  onEditTask,
  onDuplicateTask,
  onDeleteTask,
  onToggleStatus,
  onRunNow,
  onViewLogs,
  onSeedSamples,
}: TasksViewProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const [pendingDelete, setPendingDelete] = useState<TaskRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const inInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable);
      if (e.key === '/' && !inInput && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      active: tasks.filter((t) => t.status === 'active').length,
      paused: tasks.filter((t) => t.status === 'paused').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (!q) return true;
      return (
        task.name.toLowerCase().includes(q) ||
        task.schedule.toLowerCase().includes(q) ||
        describeCronExpression(task.schedule).toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'nextRun') {
        const aTime = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity;
        const bTime = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity;
        return aTime - bTime;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [tasks, statusFilter, search, sortBy]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDeleteTask(pendingDelete);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: Search, Segmented Status Filter, Sort */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E6E8F0] bg-white p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or cron schedule… ( / )"
            aria-label="Search scheduled tasks"
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
                onClick={() => setSearch('')}
                aria-label="Clear task search"
                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#EEF0F6] hover:text-[#111827]"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          {/* Segmented status filter */}
          <div
            role="group"
            aria-label="Filter tasks by status"
            className="grid grid-cols-4 gap-1 rounded-xl bg-[#F6F7FB] p-1 sm:inline-flex"
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatusFilterChange(tab.id)}
                  className={`relative min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    active ? 'text-[#111827]' : 'text-[#525B70] hover:text-[#111827]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="taskStatusFilter"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    />
                  )}
                  <span className="relative z-10 tabular-nums">
                    {tab.label} ({counts[tab.id]})
                  </span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#525B70]">
            <span className="sr-only">Sort tasks</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort tasks"
              className="min-h-[40px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-xs font-medium text-[#111827] focus:border-[#5865F2] focus:outline-none sm:w-auto"
            >
              <option value="updated">Recently Updated</option>
              <option value="nextRun">Next Scheduled Run</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </label>
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C]">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetryLoad}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#B91C1C] hover:bg-[#FEE2E2]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && tasks.length === 0 ? (
        <div className="divide-y divide-[#EEF0F6] overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-center justify-between gap-4 px-5 py-4"
            >
              <div className="space-y-2">
                <div className="h-4 w-44 rounded bg-[#E6E8F0]" />
                <div className="h-3 w-64 rounded bg-[#F1F3F8]" />
              </div>
              <div className="h-8 w-24 rounded-lg bg-[#E6E8F0]" />
            </div>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#E6E8F0] bg-white p-8 text-center"
        >
          {tasks.length === 0 ? (
            <>
              <h3 className="font-display text-base font-semibold text-[#111827]">
                No scheduled webhook tasks yet
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[#525B70]">
                Set up your first automated Discord dispatch with custom embeds and automatic retry
                protection.
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={onCreateTask}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-[#4752C4]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Task</span>
                </motion.button>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={onSeedSamples}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-[#111827] hover:bg-[#F6F7FB]"
                >
                  <Sparkles className="h-4 w-4 text-[#5865F2]" />
                  <span>{seeding ? 'Loading…' : 'Load Starter Templates'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-base font-semibold text-[#111827]">
                No tasks match your current filters
              </h3>
              <p className="mt-1.5 text-sm text-[#525B70]">
                Try clearing your search query or switching back to all statuses.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  onStatusFilterChange('all');
                }}
                className="mt-4 min-h-[40px] rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-[#F6F7FB]"
              >
                Clear Filters
              </button>
            </>
          )}
        </motion.div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          runningTaskIds={runningTaskIds}
          recentRunFeedback={recentRunFeedback}
          togglingTaskIds={togglingTaskIds}
          onEditTask={onEditTask}
          onDuplicateTask={onDuplicateTask}
          onRequestDelete={setPendingDelete}
          onToggleStatus={onToggleStatus}
          onRunNow={onRunNow}
          onViewLogs={onViewLogs}
        />
      )}

      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.name || ''}"?`}
        description="This permanently stops the cron schedule and removes all linked execution logs from PostgreSQL. This action cannot be undone."
        confirmLabel="Delete Task"
        busy={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
