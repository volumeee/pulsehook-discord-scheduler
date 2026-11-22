import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateTaskInput, TaskRecord, TaskStatus } from '../../types/task';
import { describeCronExpression, getUpcomingRuns, isValidCronExpression } from '../../utils/cron';
import { DEFAULT_PAYLOAD, useDiscordPayload } from './useDiscordPayload';
import type { DiscordPayloadEditorState } from './useDiscordPayload';

export type TaskEditorSection = 'configure' | 'json' | 'preview';

export interface TaskEditorState {
  name: string;
  setName: (value: string) => void;
  webhookUrl: string;
  setWebhookUrl: (value: string) => void;
  schedule: string;
  setSchedule: (value: string) => void;
  maxRetry: number;
  setMaxRetry: (value: number) => void;
  retryDelayMs: number;
  setRetryDelayMs: (value: number) => void;
  status: TaskStatus;
  setStatus: (value: TaskStatus) => void;
  mobileSection: TaskEditorSection;
  setMobileSection: (value: TaskEditorSection) => void;
  payloadEditor: DiscordPayloadEditorState;
  submitError: string | null;
  cronValid: boolean;
  cronDescription: string;
  upcomingRuns: Date[];
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useTaskEditor({
  open,
  editingTask,
  onSave,
}: {
  open: boolean;
  editingTask: TaskRecord | null;
  onSave: (input: CreateTaskInput, existingId?: number) => Promise<void>;
}): TaskEditorState {
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [schedule, setSchedule] = useState('0 9 * * 1-5');
  const [maxRetry, setMaxRetry] = useState(3);
  const [retryDelayMs, setRetryDelayMs] = useState(1000);
  const [status, setStatus] = useState<TaskStatus>('active');
  const [mobileSection, setMobileSection] = useState<TaskEditorSection>('configure');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const payloadEditor = useDiscordPayload();
  const { payload, jsonError, resetPayload } = payloadEditor;
  const initializedTask = useRef<number | 'new' | null>(null);

  useEffect(() => {
    if (!open) {
      initializedTask.current = null;
      return;
    }
    const taskKey = editingTask?.id ?? 'new';
    if (initializedTask.current === taskKey) return;
    initializedTask.current = taskKey;
    setSubmitError(null);
    setMobileSection('configure');
    if (editingTask) {
      setName(editingTask.name);
      setWebhookUrl(editingTask.webhookUrl);
      setSchedule(editingTask.schedule);
      setMaxRetry(editingTask.maxRetry);
      setRetryDelayMs(editingTask.retryDelayMs);
      setStatus(editingTask.status);
      resetPayload(editingTask.payload);
    } else {
      setName('');
      setWebhookUrl('');
      setSchedule('0 9 * * 1-5');
      setMaxRetry(3);
      setRetryDelayMs(1000);
      setStatus('active');
      resetPayload(DEFAULT_PAYLOAD);
    }
  }, [open, editingTask, resetPayload]);

  const cronValid = useMemo(() => isValidCronExpression(schedule), [schedule]);
  const cronDescription = useMemo(() => describeCronExpression(schedule), [schedule]);
  const upcomingRuns = useMemo(
    () => (cronValid ? getUpcomingRuns(schedule, 3) : []),
    [schedule, cronValid]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (name.trim().length < 2) {
      setSubmitError('Give this task a clear name (at least 2 characters).');
      return;
    }
    if (!cronValid) {
      setSubmitError('Enter a valid 5-field cron schedule (for example: 0 9 * * 1-5).');
      return;
    }
    if (
      !/^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api(?:\/v\d+)?\/webhooks\/\d{15,22}\/[A-Za-z0-9_-]{20,120}\/?$/.test(
        webhookUrl.trim()
      )
    ) {
      setSubmitError(
        'Use an official HTTPS Discord webhook URL: https://discord.com/api/webhooks/{id}/{token}'
      );
      return;
    }
    if (jsonError) {
      setSubmitError('Fix the JSON payload before saving.');
      return;
    }
    const hasContent = Boolean(payload.content && payload.content.trim().length > 0);
    const hasEmbeds = Boolean(payload.embeds && payload.embeds.length > 0);
    if (!hasContent && !hasEmbeds) {
      setSubmitError('Add either message content or an embed so Discord has something to display.');
      return;
    }
    const hasBlankField = (payload.embeds ?? []).some((embed) =>
      (embed.fields ?? []).some((field) => !field.name.trim() || !field.value.trim())
    );
    if (hasBlankField) {
      setSubmitError('Every embed field requires both a non-empty label and value.');
      return;
    }
    const hasBlankFooter = (payload.embeds ?? []).some(
      (embed) => embed.footer !== undefined && !embed.footer.text.trim()
    );
    if (hasBlankFooter) {
      setSubmitError('Embed footer text cannot be blank. Clear the footer or enter text.');
      return;
    }

    try {
      await onSave(
        {
          name: name.trim(),
          schedule: schedule.trim(),
          webhookUrl: webhookUrl.trim(),
          payload,
          maxRetry,
          retryDelayMs,
          status,
        },
        editingTask?.id
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save task.');
    }
  };

  return {
    name,
    setName,
    webhookUrl,
    setWebhookUrl,
    schedule,
    setSchedule,
    maxRetry,
    setMaxRetry,
    retryDelayMs,
    setRetryDelayMs,
    status,
    setStatus,
    mobileSection,
    setMobileSection,
    payloadEditor,
    submitError,
    cronValid,
    cronDescription,
    upcomingRuns,
    handleSubmit,
  };
}
