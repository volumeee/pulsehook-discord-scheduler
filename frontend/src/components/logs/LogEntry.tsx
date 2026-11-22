'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Play } from 'lucide-react';
import type { TaskLogRecord } from '../../types/task';
import { formatRelativePast } from '../../utils/time';
import { CopyButton } from '../shared/CopyButton';
import { EASE_SETTLE } from '../shared/motion';
import { LogStatusLabel } from './LogStatusLabel';

interface LogEntryProps {
  log: TaskLogRecord;
  expanded: boolean;
  isRunning: boolean;
  onToggle: () => void;
  onRerunTask: (taskId: number) => void;
}

export function LogEntry({ log, expanded, isRunning, onToggle, onRerunTask }: LogEntryProps) {
  const detailCopy = [
    `Task: ${log.taskName || `#${log.taskId}`}`,
    `Status: ${log.status} (retry ${log.retryCount})`,
    `HTTP Status: ${log.httpStatus ?? 'Network error'}`,
    `Duration: ${log.durationMs}ms`,
    `Executed At: ${log.executionTime}`,
    `Message: ${log.message}`,
  ].join('\n');

  return (
    <motion.div
      key={log.id}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: EASE_SETTLE }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#FAFBFD] sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="truncate font-semibold text-[#111827]">
              {log.taskName || `Task #${log.taskId}`}
            </span>
            <span aria-hidden="true" className="text-[#CBD5E1]">
              ·
            </span>
            <LogStatusLabel status={log.status} />
            <span aria-hidden="true" className="text-[#CBD5E1]">
              ·
            </span>
            <span className="font-mono text-[#525B70] tabular-nums">
              {log.retryCount === 0 ? 'Initial try' : `Retry #${log.retryCount}`}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[#525B70]">{log.message}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right font-mono text-xs tabular-nums">
            <div className="font-medium text-[#111827]">
              {log.httpStatus ? `HTTP ${log.httpStatus}` : 'Err'}
            </div>
            <div className="text-[11px] text-[#525B70]">
              {log.durationMs}ms · {formatRelativePast(log.executionTime)}
            </div>
          </div>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.18, ease: EASE_SETTLE }}
            className="text-[#9CA3AF]"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_SETTLE }}
            className="overflow-hidden border-t border-[#EEF0F6] bg-[#FAFBFD]"
          >
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-[#525B70]">Timestamp</span>
                  <p className="mt-0.5 font-mono font-medium text-[#111827] tabular-nums">
                    {new Date(log.executionTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[#525B70]">HTTP Status</span>
                  <p className="mt-0.5 font-mono font-medium text-[#111827] tabular-nums">
                    {log.httpStatus ?? 'No HTTP response'}
                  </p>
                </div>
                <div>
                  <span className="text-[#525B70]">Retry Count</span>
                  <p className="mt-0.5 font-mono font-medium text-[#111827] tabular-nums">
                    {log.retryCount}
                  </p>
                </div>
                <div>
                  <span className="text-[#525B70]">Latency</span>
                  <p className="mt-0.5 font-mono font-medium text-[#111827] tabular-nums">
                    {log.durationMs} ms
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E6E8F0] bg-white p-3 font-mono text-xs leading-relaxed break-words text-[#111827]">
                {log.message}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <CopyButton text={detailCopy} label="Copy Details" copiedLabel="Copied" />
                {log.status === 'failed' && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={isRunning}
                    onClick={() => onRerunTask(log.taskId)}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#4752C4] disabled:opacity-60"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{isRunning ? 'Re-running…' : 'Re-run Task'}</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
