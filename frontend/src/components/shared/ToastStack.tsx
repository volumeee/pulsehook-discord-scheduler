'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { EASE_SETTLE } from './motion';

export interface ToastItem {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-3 right-3 left-3 z-50 flex flex-col items-center gap-1.5 sm:top-auto sm:right-5 sm:bottom-5 sm:left-auto sm:w-[360px] sm:items-stretch sm:gap-2"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast, index) => {
          const isLatest = index === toasts.length - 1;
          const icon =
            toast.tone === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#15803D] sm:h-4 sm:w-4" />
            ) : toast.tone === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#DC2626] sm:h-4 sm:w-4" />
            ) : (
              <Info className="h-3.5 w-3.5 shrink-0 text-[#5865F2] sm:h-4 sm:w-4" />
            );

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE_SETTLE }}
              className={`${
                isLatest ? '' : 'hidden sm:block'
              }pointer-events-auto relative w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-[#E6E8F0] bg-white/95 px-2.5 py-1.5 shadow-md shadow-slate-900/5 backdrop-blur-sm sm:w-full sm:max-w-none sm:rounded-xl sm:bg-white sm:p-3.5 sm:shadow-lg`}
            >
              <div className="flex items-center gap-2 sm:items-start sm:gap-2.5">
                <div className="sm:mt-0.5">{icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#111827] sm:text-sm sm:whitespace-normal">
                    {toast.title}
                  </p>
                  {toast.detail && (
                    <p className="mt-0.5 hidden text-xs leading-relaxed text-[#525B70] sm:block">
                      {toast.detail}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827] sm:h-7 sm:w-7"
                >
                  <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4.5, ease: 'linear' }}
                style={{ transformOrigin: 'left' }}
                className={`absolute right-0 bottom-0 left-0 h-0.5 ${
                  toast.tone === 'success'
                    ? 'bg-[#15803D]/50'
                    : toast.tone === 'error'
                      ? 'bg-[#DC2626]/50'
                      : 'bg-[#5865F2]/50'
                }`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
