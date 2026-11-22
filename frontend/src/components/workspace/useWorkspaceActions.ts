'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/api';
import type { CreateTaskInput, TaskRecord, TaskStatus } from '../../types/task';
import type { ToastItem } from '../shared/ToastStack';

interface WorkspaceActionOptions {
  isCurrent: () => boolean;
  handleUnauthorized: (error: unknown) => boolean;
  pushToast: (tone: ToastItem['tone'], title: string, detail?: string) => void;
  refreshWorkspace: (silent?: boolean) => Promise<void>;
  setActiveTab: (tab: 'tasks') => void;
}

export function useWorkspaceActions({
  isCurrent,
  handleUnauthorized,
  pushToast,
  refreshWorkspace,
  setActiveTab,
}: WorkspaceActionOptions) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [seedingSamples, setSeedingSamples] = useState(false);
  const [runningTaskIds, setRunningTaskIds] = useState<Set<number>>(new Set());
  const [recentRunFeedback, setRecentRunFeedback] = useState<Record<number, 'success' | 'failed'>>(
    {}
  );
  const [togglingTaskIds, setTogglingTaskIds] = useState<Set<number>>(new Set());
  const feedbackTimers = useRef(new Map<number, number>());

  useEffect(() => {
    const timers = feedbackTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const openCreateEditor = useCallback(() => {
    if (!isCurrent()) return;
    setEditingTask(null);
    setEditorOpen(true);
  }, [isCurrent]);

  const openEditEditor = useCallback(
    (task: TaskRecord) => {
      if (!isCurrent()) return;
      setEditingTask(task);
      setEditorOpen(true);
    },
    [isCurrent]
  );

  // Keyboard shortcut: N -> new task
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCurrent()) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (
        !isTyping &&
        !editorOpen &&
        !document.querySelector('[role="dialog"]') &&
        event.key.toLowerCase() === 'n'
      ) {
        event.preventDefault();
        openCreateEditor();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen, isCurrent, openCreateEditor]);

  const handleSaveTask = useCallback(
    async (input: CreateTaskInput, existingId?: number) => {
      if (!isCurrent()) return;
      setSavingTask(true);
      try {
        if (existingId) {
          const updated = await apiClient.updateTask(existingId, input);
          if (!isCurrent()) return;
          pushToast(
            'success',
            `Updated "${updated.name}"`,
            updated.status === 'active'
              ? 'Scheduler refreshed with the latest cron rule.'
              : updated.status === 'failed'
                ? 'Task saved in failed state.'
                : 'Task saved in paused state.'
          );
        } else {
          const created = await apiClient.createTask(input);
          if (!isCurrent()) return;
          pushToast(
            'success',
            `Scheduled "${created.name}"`,
            created.status === 'active'
              ? 'Cron job is live and queued for its next run.'
              : 'Task created in paused state.'
          );
        }
        setEditorOpen(false);
        setEditingTask(null);
        await refreshWorkspace(true);
      } catch (err) {
        if (!handleUnauthorized(err)) {
          throw err;
        }
      } finally {
        setSavingTask(false);
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  const handleToggleStatus = useCallback(
    async (task: TaskRecord) => {
      if (!isCurrent()) return;
      const nextStatus: TaskStatus = task.status === 'active' ? 'paused' : 'active';
      setTogglingTaskIds((prev) => new Set(prev).add(task.id));
      try {
        await apiClient.updateTask(task.id, { status: nextStatus });
        if (!isCurrent()) return;
        pushToast(
          'info',
          nextStatus === 'active' ? `Resumed "${task.name}"` : `Paused "${task.name}"`,
          nextStatus === 'active'
            ? 'Cron schedule is active again.'
            : 'Automatic deliveries are paused until you resume.'
        );
        await refreshWorkspace(true);
      } catch (err) {
        if (!handleUnauthorized(err)) {
          pushToast(
            'error',
            'Could not update status',
            err instanceof Error ? err.message : 'Unexpected server error.'
          );
        }
      } finally {
        setTogglingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  const handleDuplicateTask = useCallback(
    async (task: TaskRecord) => {
      if (!isCurrent()) return;
      try {
        const clone = await apiClient.duplicateTask(task.id);
        if (!isCurrent()) return;
        pushToast(
          'success',
          `Duplicated "${task.name}"`,
          `Created "${clone.name}" in paused mode so you can review before enabling.`
        );
        await refreshWorkspace(true);
      } catch (err) {
        if (!handleUnauthorized(err)) {
          pushToast(
            'error',
            'Duplicate failed',
            err instanceof Error ? err.message : 'Unexpected error.'
          );
        }
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  const handleDeleteTask = useCallback(
    async (task: TaskRecord) => {
      if (!isCurrent()) return;
      try {
        await apiClient.deleteTask(task.id);
        if (!isCurrent()) return;
        pushToast('info', `Deleted "${task.name}"`, 'Task and its execution history were removed.');
        await refreshWorkspace(true);
      } catch (err) {
        if (!handleUnauthorized(err)) {
          pushToast(
            'error',
            'Delete failed',
            err instanceof Error ? err.message : 'Unexpected error.'
          );
        }
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  const handleRunTaskById = useCallback(
    async (taskId: number, taskName?: string) => {
      if (!isCurrent()) return;
      setRunningTaskIds((prev) => new Set(prev).add(taskId));
      try {
        const res = await apiClient.runTaskNow(taskId);
        if (!isCurrent()) return;
        const outcome = res.outcome;
        const label = taskName || res.task?.name || `Task #${taskId}`;
        setRecentRunFeedback((prev) => ({
          ...prev,
          [taskId]: outcome.succeeded ? 'success' : 'failed',
        }));
        const previousTimer = feedbackTimers.current.get(taskId);
        if (previousTimer !== undefined) window.clearTimeout(previousTimer);
        const timer = window.setTimeout(() => {
          feedbackTimers.current.delete(taskId);
          setRecentRunFeedback((prev) => {
            const copy = { ...prev };
            delete copy[taskId];
            return copy;
          });
        }, 2800);
        feedbackTimers.current.set(taskId, timer);

        if (outcome.succeeded) {
          pushToast(
            'success',
            `Delivered "${label}"`,
            `HTTP ${outcome.httpStatus ?? 204} in ${outcome.durationMs}ms (${outcome.attempts} attempt${outcome.attempts === 1 ? '' : 's'}).`
          );
        } else {
          pushToast(
            'error',
            `Delivery failed for "${label}"`,
            `${outcome.message} (${outcome.attempts} attempt${outcome.attempts === 1 ? '' : 's'}).`
          );
        }
        await refreshWorkspace(true);
      } catch (err) {
        if (!handleUnauthorized(err)) {
          pushToast(
            'error',
            'Manual run failed',
            err instanceof Error ? err.message : 'Could not trigger webhook.'
          );
        }
      } finally {
        setRunningTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  const handleSeedSamples = useCallback(async () => {
    if (!isCurrent()) return;
    setSeedingSamples(true);
    try {
      const created = await apiClient.seedSampleTasks();
      if (!isCurrent()) return;
      pushToast(
        'success',
        `Loaded ${created.length} starter templates`,
        'Templates start paused—paste your Discord webhook URL and toggle active when ready.'
      );
      await refreshWorkspace(true);
      if (isCurrent()) setActiveTab('tasks');
    } catch (err) {
      if (!handleUnauthorized(err)) {
        pushToast(
          'error',
          'Could not load templates',
          err instanceof Error ? err.message : 'Unexpected error.'
        );
      }
    } finally {
      setSeedingSamples(false);
    }
  }, [handleUnauthorized, isCurrent, pushToast, refreshWorkspace, setActiveTab]);

  const handleCreateApiKey = useCallback(
    async (name: string) => {
      if (!isCurrent()) throw new Error('Your session has changed.');
      try {
        const res = await apiClient.createApiKey(name);
        if (!isCurrent()) throw new Error('Your session has changed.');
        pushToast(
          'success',
          `Created key "${res.data.name}"`,
          'Copy the raw secret now—only its SHA-256 hash is kept in PostgreSQL.'
        );
        void refreshWorkspace(true);
        return res.rawKey;
      } catch (error) {
        handleUnauthorized(error);
        throw error;
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  const handleRevokeApiKey = useCallback(
    async (id: number) => {
      if (!isCurrent()) return;
      try {
        await apiClient.revokeApiKey(id);
        if (!isCurrent()) return;
        pushToast('info', 'API key revoked', 'Requests using that key will now receive HTTP 401.');
        await refreshWorkspace(true);
      } catch (error) {
        if (!handleUnauthorized(error)) {
          pushToast(
            'error',
            'Could not revoke API key',
            error instanceof Error ? error.message : 'Unexpected server error.'
          );
        }
      }
    },
    [handleUnauthorized, isCurrent, pushToast, refreshWorkspace]
  );

  return {
    editorOpen,
    setEditorOpen,
    editingTask,
    setEditingTask,
    savingTask,
    seedingSamples,
    runningTaskIds,
    recentRunFeedback,
    togglingTaskIds,
    openCreateEditor,
    openEditEditor,
    handleSaveTask,
    handleToggleStatus,
    handleDuplicateTask,
    handleDeleteTask,
    handleRunTaskById,
    handleSeedSamples,
    handleCreateApiKey,
    handleRevokeApiKey,
  };
}
