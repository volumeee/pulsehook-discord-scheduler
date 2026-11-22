import type { DiscordWebhookPayload } from '../../types/task';

export const INVALID_DISCORD_PAYLOAD =
  'Payload must be a JSON object matching Discord Webhook format.';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value == null || typeof value === 'string';
}

export function isRenderableDiscordPayload(value: unknown): value is DiscordWebhookPayload {
  if (!isObject(value)) return false;
  if (![value.content, value.username, value.avatar_url].every(isOptionalString)) return false;
  if (value.embeds == null) return true;
  if (!Array.isArray(value.embeds)) return false;

  return value.embeds.every((embed: unknown) => {
    if (!isObject(embed)) return false;
    if (![embed.title, embed.description].every(isOptionalString)) return false;
    if (embed.color != null && typeof embed.color !== 'number') return false;
    if (embed.footer != null && (!isObject(embed.footer) || typeof embed.footer.text !== 'string'))
      return false;
    if (embed.fields == null) return true;
    if (!Array.isArray(embed.fields)) return false;
    return embed.fields.every(
      (field: unknown) =>
        isObject(field) &&
        typeof field.name === 'string' &&
        typeof field.value === 'string' &&
        (field.inline == null || typeof field.inline === 'boolean')
    );
  });
}

export function createPayloadDraft(value: unknown): {
  payload: DiscordWebhookPayload;
  rawJson: string;
  jsonError: string | null;
} {
  const valid = isRenderableDiscordPayload(value);
  return {
    payload: valid ? value : {},
    rawJson: JSON.stringify(value, null, 2) ?? 'null',
    jsonError: valid ? null : INVALID_DISCORD_PAYLOAD,
  };
}
