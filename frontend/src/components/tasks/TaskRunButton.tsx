'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, Loader2, Play } from 'lucide-react';
import type { TaskRecord } from '../../types/task';

interface TaskRunButtonProps {
  task: TaskRecord;
  running: boolean;
  feedback: 'success' | 'failed' | undefined;
  onRunNow: (task: TaskRecord) => void;
  fullWidth?: boolean;
}

export function TaskRunButton({
  task,
  running,
  feedback,
  onRunNow,
  fullWidth = false,
}: TaskRunButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      disabled={running}
      onClick={() => onRunNow(task)}
      aria-label={`Run ${task.name} now`}
      className={`inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:outline-none ${
        fullWidth ? 'min-h-[44px] flex-1' : ''
      } ${
        feedback === 'success'
          ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
          : feedback === 'failed'
            ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
            : 'border-[#E6E8F0] bg-white text-[#111827] hover:border-[#5865F2] hover:text-[#5865F2]'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {running ? (
          <motion.span
            key="running"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1.5"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5865F2]" />
            <span>Sending…</span>
          </motion.span>
        ) : feedback === 'success' ? (
          <motion.span
            key="ok"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Sent</span>
          </motion.span>
        ) : feedback === 'failed' ? (
          <motion.span
            key="err"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1.5"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Failed</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="inline-flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Run Now</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
