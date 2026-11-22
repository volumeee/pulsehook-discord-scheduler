'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Copy, FileText, Pencil, Trash2 } from 'lucide-react';
import { describeCronExpression, maskWebhookUrl } from '../../utils/cron';
import { formatRelativeCountdown, formatRelativePast } from '../../utils/time';
import { SpringSwitch } from '../shared/SpringSwitch';
import { EASE_SETTLE } from '../shared/motion';
import { TaskRunButton } from './TaskRunButton';
import { TaskStatusLabel } from './TaskStatusLabel';
import type { TaskListProps } from './TaskList';

export function TaskCards({
  tasks: filteredTasks,
  runningTaskIds,
  recentRunFeedback,
  togglingTaskIds,
  onEditTask,
  onDuplicateTask,
  onRequestDelete,
  onToggleStatus,
  onRunNow,
  onViewLogs,
}: TaskListProps) {
  return (
    <div className="space-y-3 md:hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {filteredTasks.map((task) => {
          const isActive = task.status === 'active';
          const isToggling = togglingTaskIds.has(task.id);
          return (
            <motion.article
              key={task.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: EASE_SETTLE }}
              className="rounded-2xl border border-[#E6E8F0] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display truncate text-sm font-semibold text-[#111827]">
                    {task.name}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <TaskStatusLabel status={task.status} />
                    <span aria-hidden="true" className="text-[#CBD5E1]">
                      ·
                    </span>
                    <span className="font-mono text-[#111827] tabular-nums">{task.schedule}</span>
                    <span aria-hidden="true" className="text-[#CBD5E1]">
                      ·
                    </span>
                    <span className="text-[#525B70] tabular-nums">{task.maxRetry} retries</span>
                  </p>
                </div>
                <SpringSwitch
                  checked={isActive}
                  disabled={isToggling}
                  onChange={() => onToggleStatus(task)}
                  label={`${isActive ? 'Pause' : 'Resume'} ${task.name}`}
                />
              </div>

              <p className="mt-2.5 text-xs text-[#525B70]">
                {describeCronExpression(task.schedule)}
              </p>
              <div className="mt-2 flex items-center justify-between font-mono text-xs text-[#525B70] tabular-nums">
                <span className="truncate pr-2">{maskWebhookUrl(task.webhookUrl)}</span>
                <span className="shrink-0 text-[#111827]">
                  {task.status === 'active'
                    ? formatRelativeCountdown(task.nextRunAt)
                    : `Last: ${formatRelativePast(task.lastRunAt)}`}
                </span>
              </div>

              {/* Touch-friendly Action Bar (>=44px height) */}
              <div className="mt-3.5 flex items-center gap-2 border-t border-[#EEF0F6] pt-3">
                <TaskRunButton
                  task={task}
                  running={runningTaskIds.has(task.id)}
                  feedback={recentRunFeedback[task.id]}
                  onRunNow={onRunNow}
                  fullWidth
                />
                <button
                  type="button"
                  onClick={() => onViewLogs(task.id)}
                  aria-label={`Inspect logs for ${task.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E8F0] text-[#525B70] active:bg-[#F6F7FB]"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateTask(task)}
                  aria-label={`Duplicate ${task.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E8F0] text-[#525B70] active:bg-[#F6F7FB]"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  aria-label={`Edit ${task.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E8F0] text-[#5865F2] active:bg-[#EEF0FE]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDelete(task)}
                  aria-label={`Delete ${task.name}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E6E8F0] text-[#DC2626] active:bg-[#FEF2F2]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
