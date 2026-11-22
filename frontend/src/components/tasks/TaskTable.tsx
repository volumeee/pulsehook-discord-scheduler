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

export function TaskTable({
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
    <div className="hidden overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E6E8F0] bg-[#FAFBFD] text-xs font-semibold text-[#525B70]">
              <th className="py-3 pr-3 pl-5">Task &amp; Webhook</th>
              <th className="px-3 py-3">Schedule</th>
              <th className="px-3 py-3">Status &amp; Retry</th>
              <th className="px-3 py-3 text-right">Next / Last Run</th>
              <th className="py-3 pr-5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF0F6] text-sm">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredTasks.map((task) => {
                const isActive = task.status === 'active';
                const isToggling = togglingTaskIds.has(task.id);
                return (
                  <motion.tr
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: EASE_SETTLE }}
                    className="group transition-colors hover:bg-[#FAFBFD]"
                  >
                    <td className="max-w-[280px] py-3.5 pr-3 pl-5">
                      <p className="truncate font-semibold text-[#111827]">{task.name}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-[#525B70]">
                        {maskWebhookUrl(task.webhookUrl)}
                      </p>
                    </td>

                    <td className="px-3 py-3.5">
                      <p className="font-mono text-xs font-medium text-[#111827] tabular-nums">
                        {task.schedule}
                      </p>
                      <p className="mt-0.5 text-xs text-[#525B70]">
                        {describeCronExpression(task.schedule)}
                      </p>
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <SpringSwitch
                          checked={isActive}
                          disabled={isToggling}
                          onChange={() => onToggleStatus(task)}
                          label={`${isActive ? 'Pause' : 'Resume'} ${task.name}`}
                        />
                        <div className="text-xs">
                          <TaskStatusLabel status={task.status} />
                          <span className="mx-1.5 text-[#CBD5E1]" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-[#525B70] tabular-nums">
                            {task.maxRetry} {task.maxRetry === 1 ? 'retry' : 'retries'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums">
                      <div className="font-medium text-[#111827]">
                        {task.status === 'active'
                          ? formatRelativeCountdown(task.nextRunAt)
                          : task.status === 'failed'
                            ? 'Failed'
                            : 'Paused'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#525B70]">
                        Last: {formatRelativePast(task.lastRunAt)}
                      </div>
                    </td>

                    <td className="py-3.5 pr-5 pl-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <TaskRunButton
                          task={task}
                          running={runningTaskIds.has(task.id)}
                          feedback={recentRunFeedback[task.id]}
                          onRunNow={onRunNow}
                        />
                        <button
                          type="button"
                          onClick={() => onViewLogs(task.id)}
                          aria-label={`Inspect logs for ${task.name}`}
                          title="Inspect Logs"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[#525B70] transition-colors hover:border-[#E6E8F0] hover:bg-white hover:text-[#111827]"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicateTask(task)}
                          aria-label={`Duplicate ${task.name}`}
                          title="Duplicate Task"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[#525B70] transition-colors hover:border-[#E6E8F0] hover:bg-white hover:text-[#111827]"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          aria-label={`Edit ${task.name}`}
                          title="Edit Task"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[#525B70] transition-colors hover:border-[#E6E8F0] hover:bg-white hover:text-[#5865F2]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestDelete(task)}
                          aria-label={`Delete ${task.name}`}
                          title="Delete Task"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[#525B70] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
