'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Braces, Eye, SlidersHorizontal, X } from 'lucide-react';
import type { CreateTaskInput, TaskRecord } from '../../types/task';
import { EASE_SETTLE, SPRING_SNAPPY } from '../shared/motion';
import { DestinationSection } from './DestinationSection';
import { PayloadEditor } from './PayloadEditor';
import { ScheduleSection } from './ScheduleSection';
import { RetryPolicySection } from './RetryPolicySection';
import { TaskPreview } from './TaskPreview';
import { useTaskEditor } from './useTaskEditor';

interface TaskEditorSheetProps {
  open: boolean;
  editingTask: TaskRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: CreateTaskInput, existingId?: number) => Promise<void>;
}

export function TaskEditorSheet({
  open,
  editingTask,
  saving,
  onClose,
  onSave,
}: TaskEditorSheetProps) {
  const editor = useTaskEditor({ open, editingTask, onSave });
  const {
    schedule,
    setSchedule,
    mobileSection,
    setMobileSection,
    payloadEditor,
    submitError,
    cronValid,
    cronDescription,
    upcomingRuns,
    handleSubmit,
  } = editor;

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, saving, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end lg:items-stretch"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-editor-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !saving && onClose()}
            className="fixed inset-0 bg-[#111827]/45"
          />

          {/* Adaptive Sheet: Slide-up Bottom Sheet on mobile, Slide-left Side Drawer on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 28, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 24, x: 0 }}
            transition={{ duration: 0.22, ease: EASE_SETTLE }}
            className="relative z-10 flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-[#E6E8F0] bg-[#F6F7FB] shadow-2xl lg:h-full lg:max-w-5xl lg:rounded-t-none lg:rounded-l-3xl lg:border-t-0 lg:border-l"
          >
            {/* Mobile Grab Handle */}
            <div className="flex justify-center bg-white pt-2.5 lg:hidden">
              <div className="h-1.5 w-10 rounded-full bg-[#D5D9E4]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[#E6E8F0] bg-white px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="task-editor-title"
                  className="font-display text-lg font-bold text-[#111827]"
                >
                  {editingTask ? `Edit "${editingTask.name}"` : 'New Scheduled Webhook'}
                </h2>
                <p className="mt-0.5 text-xs text-[#525B70]">
                  Configure your schedule, retry policy, and preview the live Discord embed before
                  saving.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Close task editor"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#E6E8F0] bg-white text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile Section Switcher */}
            <div className="border-b border-[#E6E8F0] bg-white px-4 py-2.5 lg:hidden">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F6F7FB] p-1">
                {(
                  [
                    { id: 'configure', label: 'Builder', icon: SlidersHorizontal },
                    { id: 'json', label: 'JSON', icon: Braces },
                    { id: 'preview', label: 'Preview', icon: Eye },
                  ] as const
                ).map((tab) => {
                  const active = mobileSection === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileSection(tab.id)}
                      className={`relative flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        active ? 'text-[#111827]' : 'text-[#525B70]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="mobileEditorTab"
                          transition={SPRING_SNAPPY}
                          className="absolute inset-0 rounded-lg bg-white shadow-sm"
                        />
                      )}
                      <Icon className="relative z-10 h-3.5 w-3.5" />
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <form
              id="task-editor-form"
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
                {/* Left Column: Form + Cron + Payload */}
                <div
                  className={`space-y-5 p-5 sm:p-6 lg:col-span-7 lg:overflow-y-auto ${
                    mobileSection === 'preview' ? 'hidden lg:block' : 'block'
                  }`}
                >
                  <AnimatePresence>
                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium text-[#B91C1C]"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{submitError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <DestinationSection editor={editor} />

                  <ScheduleSection
                    schedule={schedule}
                    setSchedule={setSchedule}
                    cronValid={cronValid}
                    cronDescription={cronDescription}
                    upcomingRuns={upcomingRuns}
                    mobileSection={mobileSection}
                  />

                  <RetryPolicySection editor={editor} />

                  <PayloadEditor mobileSection={mobileSection} editor={payloadEditor} />
                </div>
                <TaskPreview editor={editor} />
              </div>

              {/* Sticky Footer Actions */}
              <div className="pb-safe flex items-center justify-between gap-3 border-t border-[#E6E8F0] bg-white px-5 py-3.5 sm:px-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="min-h-[44px] rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-[#111827] transition-colors hover:bg-[#F6F7FB] sm:min-h-[40px]"
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.97 }}
                  disabled={saving}
                  className="min-h-[44px] flex-1 rounded-xl bg-[#5865F2] px-5 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#4752C4] disabled:opacity-60 sm:min-h-[40px] sm:flex-none"
                >
                  {saving ? 'Saving Task…' : editingTask ? 'Save Changes' : 'Create Scheduled Task'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
