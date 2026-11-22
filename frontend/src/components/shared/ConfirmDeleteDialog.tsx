'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EASE_SETTLE } from './motion';

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete Task',
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => !busy && onCancel()}
            className="fixed inset-0 bg-[#111827]/35 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE_SETTLE }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#E6E8F0] bg-white p-6 shadow-xl"
          >
            <h3
              id="confirm-dialog-title"
              className="font-display text-base font-semibold text-[#111827]"
            >
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#525B70]">{description}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="min-h-[44px] rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-sm font-medium whitespace-nowrap text-[#111827] transition-colors hover:bg-[#F6F7FB] sm:min-h-[38px]"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                disabled={busy}
                className="min-h-[44px] rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60 sm:min-h-[38px]"
              >
                {busy ? 'Deleting…' : confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
