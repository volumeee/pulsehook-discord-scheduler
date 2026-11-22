import { useCallback, useState } from 'react';
import type { DiscordEmbed, DiscordEmbedField, DiscordWebhookPayload } from '../../types/task';
import { DISCORD_PAYLOAD_PRESETS } from '../../utils/discordTemplates';
import { createPayloadDraft, INVALID_DISCORD_PAYLOAD, isRenderableDiscordPayload } from './payload';

export const DEFAULT_PAYLOAD: DiscordWebhookPayload = DISCORD_PAYLOAD_PRESETS[0].payload;

export interface DiscordPayloadEditorState {
  payload: DiscordWebhookPayload;
  rawJson: string;
  jsonError: string | null;
  payloadMode: 'visual' | 'json';
  setPayloadMode: (mode: 'visual' | 'json') => void;
  primaryEmbed: DiscordEmbed | null;
  resetPayload: (payload: DiscordWebhookPayload) => void;
  updatePayloadFromVisual: (payload: DiscordWebhookPayload) => void;
  handleRawJsonChange: (text: string) => void;
  handleFormatJson: () => void;
  updatePrimaryEmbed: (updater: (embed: DiscordEmbed) => DiscordEmbed) => void;
  toggleEmbedEnabled: (enabled: boolean) => void;
  addEmbedField: () => void;
  updateEmbedField: (index: number, patch: Partial<DiscordEmbedField>) => void;
  removeEmbedField: (index: number) => void;
}

export function useDiscordPayload(): DiscordPayloadEditorState {
  const [payload, setPayload] = useState<DiscordWebhookPayload>(DEFAULT_PAYLOAD);
  const [rawJson, setRawJson] = useState(() => JSON.stringify(DEFAULT_PAYLOAD, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [payloadMode, setPayloadMode] = useState<'visual' | 'json'>('visual');
  const primaryEmbed = payload.embeds?.[0] ?? null;

  const resetPayload = useCallback((next: DiscordWebhookPayload) => {
    const draft = createPayloadDraft(next);
    setPayload(draft.payload);
    setRawJson(draft.rawJson);
    setJsonError(draft.jsonError);
    setPayloadMode('visual');
  }, []);

  const updatePayloadFromVisual = (next: DiscordWebhookPayload) => {
    if (jsonError) return;
    setPayload(next);
    setRawJson(JSON.stringify(next, null, 2));
  };

  const handleRawJsonChange = (text: string) => {
    setRawJson(text);
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isRenderableDiscordPayload(parsed)) {
        setJsonError(INVALID_DISCORD_PAYLOAD);
        return;
      }
      setPayload(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON syntax.');
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      if (!isRenderableDiscordPayload(parsed)) {
        setJsonError(INVALID_DISCORD_PAYLOAD);
        return;
      }
      setRawJson(JSON.stringify(parsed, null, 2));
      setPayload(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(
        err instanceof Error
          ? `Cannot format yet — ${err.message}`
          : 'Fix JSON syntax errors before formatting.'
      );
    }
  };

  const updatePrimaryEmbed = (
    updater: (
      embed: NonNullable<DiscordWebhookPayload['embeds']>[0]
    ) => NonNullable<DiscordWebhookPayload['embeds']>[0]
  ) => {
    const existing = payload.embeds?.[0] ?? { title: '', description: '', color: 5793266 };
    const updated = updater(existing);
    updatePayloadFromVisual({ ...payload, embeds: [updated, ...(payload.embeds?.slice(1) ?? [])] });
  };

  const toggleEmbedEnabled = (enabled: boolean) => {
    if (enabled) {
      updatePayloadFromVisual({
        ...payload,
        embeds: [
          {
            title: 'Task Update',
            description: 'Scheduled dispatch executed smoothly.',
            color: 5793266,
          },
        ],
      });
    } else {
      const remaining = payload.embeds?.slice(1) ?? [];
      const copy = { ...payload };
      if (remaining.length > 0) copy.embeds = remaining;
      else delete copy.embeds;
      updatePayloadFromVisual(copy);
    }
  };

  const addEmbedField = () => {
    updatePrimaryEmbed((embed) => {
      if ((embed.fields?.length ?? 0) >= 25) return embed;
      return {
        ...embed,
        fields: [...(embed.fields ?? []), { name: 'Metric', value: 'Healthy', inline: true }],
      };
    });
  };

  const updateEmbedField = (index: number, patch: Partial<DiscordEmbedField>) => {
    updatePrimaryEmbed((embed) => ({
      ...embed,
      fields: (embed.fields ?? []).map((field, idx) =>
        idx === index ? { ...field, ...patch } : field
      ),
    }));
  };

  const removeEmbedField = (index: number) => {
    updatePrimaryEmbed((embed) => ({
      ...embed,
      fields: (embed.fields ?? []).filter((_, idx) => idx !== index),
    }));
  };

  return {
    payload,
    jsonError,
    rawJson,
    payloadMode,
    setPayloadMode,
    primaryEmbed,
    resetPayload,
    updatePayloadFromVisual,
    handleRawJsonChange,
    handleFormatJson,
    updatePrimaryEmbed,
    toggleEmbedEnabled,
    addEmbedField,
    updateEmbedField,
    removeEmbedField,
  };
}
