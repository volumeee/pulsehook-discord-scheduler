import type { DiscordWebhookPayload } from '../types/task';

export interface DiscordColorSwatch {
  name: string;
  hex: string;
  decimal: number;
}

export const DISCORD_COLOR_SWATCHES: DiscordColorSwatch[] = [
  { name: 'Discord Indigo', hex: '#5865F2', decimal: 5793266 },
  { name: 'Emerald Success', hex: '#2ECC71', decimal: 3066993 },
  { name: 'Amber Warning', hex: '#F59E0B', decimal: 16096779 },
  { name: 'Crimson Alert', hex: '#ED4245', decimal: 15548997 },
  { name: 'Slate Neutral', hex: '#475569', decimal: 4674889 },
  { name: 'Sky Info', hex: '#0EA5E9', decimal: 959977 },
];

export interface PayloadPreset {
  id: string;
  label: string;
  description: string;
  payload: DiscordWebhookPayload;
}

export const DISCORD_PAYLOAD_PRESETS: PayloadPreset[] = [
  {
    id: 'task-completed',
    label: 'Task Completed',
    description: 'Clean status embed matching the standard Discord webhook format',
    payload: {
      content: 'Task executed successfully!',
      username: 'PulseHook Bot',
      embeds: [
        {
          title: 'Task Completed',
          description: 'Scheduled pipeline #123 finished cleanly with all checks passing.',
          color: 3066993,
          fields: [
            { name: 'Environment', value: 'Production', inline: true },
            { name: 'Latency', value: '142 ms', inline: true },
          ],
          footer: { text: 'PulseHook Automated Dispatch' },
        },
      ],
    },
  },
  {
    id: 'daily-standup',
    label: 'Daily Standup',
    description: 'Friendly morning check-in reminder for engineering teams',
    payload: {
      content: 'Good morning team — time to drop your quick standup update!',
      username: 'Standup Reminder',
      embeds: [
        {
          title: 'Daily Engineering Sync',
          description: 'Share what you shipped yesterday, what is up next today, and any blockers.',
          color: 5793266,
          fields: [
            { name: 'Format', value: 'Yesterday · Today · Blockers', inline: false },
            { name: 'Due by', value: '09:30 local time', inline: true },
          ],
          footer: { text: 'Keep it concise — 3 bullet points max' },
        },
      ],
    },
  },
  {
    id: 'incident-alert',
    label: 'Health Digest',
    description: 'Amber-accented service summary for operations channels',
    payload: {
      content: 'Scheduled service health check report ready for review.',
      username: 'Ops Monitor',
      embeds: [
        {
          title: 'API Gateway Latency Watch',
          description: 'Periodic heartbeat completed. Review queue depth and error budgets below.',
          color: 16096779,
          fields: [
            { name: 'Uptime (24h)', value: '99.98%', inline: true },
            { name: 'P95 Response', value: '184 ms', inline: true },
          ],
          footer: { text: 'PulseHook Ops Digest' },
        },
      ],
    },
  },
  {
    id: 'simple-ping',
    label: 'Simple Message',
    description: 'Lightweight plain-text channel announcement without embeds',
    payload: {
      content: 'Scheduled heartbeat ping — all webhook workers are healthy.',
      username: 'PulseHook',
    },
  },
];

export function decimalToHexColor(color?: number): string {
  if (typeof color !== 'number' || Number.isNaN(color) || color < 0) {
    return '#5865F2';
  }
  const clamped = Math.max(0, Math.min(0xffffff, Math.floor(color)));
  return `#${clamped.toString(16).padStart(6, '0').toUpperCase()}`;
}

export function hexToDecimalColor(hex: string): number {
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return 5793266;
  }
  return parseInt(cleaned, 16);
}
