import { motion } from 'motion/react';
import { EASE_SETTLE } from '../shared/motion';
import type { DiscordPayloadEditorState } from './useDiscordPayload';
import { EmbedBuilder } from './EmbedBuilder';

export function VisualPayloadBuilder({ editor }: { editor: DiscordPayloadEditorState }) {
  const { payload, primaryEmbed, updatePayloadFromVisual, toggleEmbedEnabled } = editor;
  const contentLen = payload.content?.length ?? 0;

  return (
    <div className="space-y-4" inert={Boolean(editor.jsonError)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="payload-username" className="block text-xs font-semibold text-[#111827]">
            Bot Username
          </label>
          <input
            id="payload-username"
            type="text"
            maxLength={80}
            value={payload.username ?? ''}
            onChange={(e) => {
              const next = { ...payload };
              if (e.target.value) next.username = e.target.value;
              else delete next.username;
              updatePayloadFromVisual(next);
            }}
            placeholder="PulseHook Bot"
            className="mt-1.5 min-h-[40px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-sm text-[#111827] focus:border-[#5865F2] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="payload-avatar" className="block text-xs font-semibold text-[#111827]">
            Avatar URL (optional)
          </label>
          <input
            id="payload-avatar"
            type="url"
            value={payload.avatar_url ?? ''}
            onChange={(e) => {
              const next = { ...payload };
              if (e.target.value) next.avatar_url = e.target.value;
              else delete next.avatar_url;
              updatePayloadFromVisual(next);
            }}
            placeholder="https://..."
            className="mt-1.5 min-h-[40px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-sm text-[#111827] focus:border-[#5865F2] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="payload-content" className="text-xs font-semibold text-[#111827]">
            Message Content
          </label>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              contentLen > 1900
                ? 'font-semibold text-[#DC2626]'
                : contentLen > 1600
                  ? 'font-medium text-[#B45309]'
                  : 'text-[#525B70]'
            }`}
          >
            {contentLen.toLocaleString()} / 2,000
          </span>
        </div>
        <textarea
          id="payload-content"
          rows={2}
          maxLength={2000}
          value={payload.content ?? ''}
          onChange={(e) =>
            updatePayloadFromVisual({
              ...payload,
              content: e.target.value,
            })
          }
          placeholder="Task executed successfully!"
          className="mt-1.5 w-full rounded-xl border border-[#E6E8F0] bg-white p-3 text-sm text-[#111827] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
        />
        <div
          className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#EEF0F6]"
          aria-hidden="true"
        >
          <motion.div
            initial={false}
            animate={{
              scaleX: Math.min(1, contentLen / 2000),
            }}
            transition={{ duration: 0.18, ease: EASE_SETTLE }}
            style={{ transformOrigin: 'left' }}
            className={`h-full w-full ${
              contentLen > 1900
                ? 'bg-[#DC2626]'
                : contentLen > 1600
                  ? 'bg-[#D97706]'
                  : 'bg-[#5865F2]'
            }`}
          />
        </div>
      </div>

      {/* Rich Embed Toggle */}
      <div className="border-t border-[#EEF0F6] pt-3.5">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-xs font-semibold text-[#111827]">Include Rich Discord Embed</span>
          <input
            type="checkbox"
            checked={Boolean(primaryEmbed)}
            onChange={(e) => toggleEmbedEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#5865F2]"
          />
        </label>
      </div>

      <EmbedBuilder editor={editor} />
    </div>
  );
}
