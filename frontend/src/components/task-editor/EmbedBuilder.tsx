import { motion } from 'motion/react';
import { Plus, Trash2 } from 'lucide-react';
import {
  DISCORD_COLOR_SWATCHES,
  decimalToHexColor,
  hexToDecimalColor,
} from '../../utils/discordTemplates';
import { EASE_SETTLE } from '../shared/motion';
import type { DiscordPayloadEditorState } from './useDiscordPayload';

export function EmbedBuilder({ editor }: { editor: DiscordPayloadEditorState }) {
  const { primaryEmbed, updatePrimaryEmbed, addEmbedField, updateEmbedField, removeEmbedField } =
    editor;
  const titleLen = primaryEmbed?.title?.length ?? 0;
  const descLen = primaryEmbed?.description?.length ?? 0;

  return (
    <>
      {primaryEmbed && (
        <div className="space-y-3.5 rounded-xl bg-[#FAFBFD] p-3.5">
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="embed-title" className="text-xs font-semibold text-[#111827]">
                Embed Title
              </label>
              <span className="font-mono text-[11px] text-[#525B70] tabular-nums">
                {titleLen} / 256
              </span>
            </div>
            <input
              id="embed-title"
              type="text"
              maxLength={256}
              value={primaryEmbed.title ?? ''}
              onChange={(e) =>
                updatePrimaryEmbed((em) => ({
                  ...em,
                  title: e.target.value,
                }))
              }
              placeholder="Task Completed"
              className="mt-1.5 min-h-[38px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-sm text-[#111827] focus:border-[#5865F2] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="embed-description" className="text-xs font-semibold text-[#111827]">
                Embed Description
              </label>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  descLen > 3890
                    ? 'font-semibold text-[#DC2626]'
                    : descLen > 3276
                      ? 'font-medium text-[#B45309]'
                      : 'text-[#525B70]'
                }`}
              >
                {descLen.toLocaleString()} / 4,096
              </span>
            </div>
            <textarea
              id="embed-description"
              rows={3}
              maxLength={4096}
              value={primaryEmbed.description ?? ''}
              onChange={(e) =>
                updatePrimaryEmbed((em) => ({
                  ...em,
                  description: e.target.value,
                }))
              }
              placeholder="Task #123 has been completed."
              className="mt-1.5 w-full rounded-xl border border-[#E6E8F0] bg-white p-3 text-sm text-[#111827] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
            />
            <div
              className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#E6E8F0]"
              aria-hidden="true"
            >
              <motion.div
                initial={false}
                animate={{
                  scaleX: Math.min(1, descLen / 4096),
                }}
                transition={{
                  duration: 0.18,
                  ease: EASE_SETTLE,
                }}
                style={{ transformOrigin: 'left' }}
                className={`h-full w-full ${
                  descLen > 3890 ? 'bg-[#DC2626]' : descLen > 3276 ? 'bg-[#D97706]' : 'bg-[#5865F2]'
                }`}
              />
            </div>
          </div>

          {/* Color Swatches */}
          <div>
            <span className="block text-xs font-semibold text-[#111827]">Accent Color</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {DISCORD_COLOR_SWATCHES.map((swatch) => {
                const selected = primaryEmbed.color === swatch.decimal;
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    aria-label={`Select ${swatch.name}`}
                    onClick={() =>
                      updatePrimaryEmbed((em) => ({
                        ...em,
                        color: swatch.decimal,
                      }))
                    }
                    className={`h-7 w-7 rounded-lg transition-transform ${
                      selected ? 'scale-110 ring-2 ring-[#111827] ring-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                );
              })}
              <input
                type="color"
                aria-label="Custom embed accent color"
                value={decimalToHexColor(primaryEmbed.color)}
                onChange={(e) =>
                  updatePrimaryEmbed((em) => ({
                    ...em,
                    color: hexToDecimalColor(e.target.value),
                  }))
                }
                className="h-7 w-9 cursor-pointer rounded-lg border border-[#E6E8F0] bg-white p-0.5"
              />
              <span className="font-mono text-xs text-[#525B70] tabular-nums">
                {decimalToHexColor(primaryEmbed.color)}
              </span>
            </div>
          </div>

          {/* Embed Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111827]">
                Embed Fields ({primaryEmbed.fields?.length ?? 0}/25)
              </span>
              <button
                type="button"
                onClick={addEmbedField}
                disabled={(primaryEmbed.fields?.length ?? 0) >= 25}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#5865F2] hover:text-[#4752C4] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            {(primaryEmbed.fields ?? []).map((field, fIdx) => (
              <div
                key={fIdx}
                className="grid grid-cols-12 items-center gap-2 rounded-xl border border-[#E6E8F0] bg-white p-2.5"
              >
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) =>
                    updateEmbedField(fIdx, {
                      name: e.target.value,
                    })
                  }
                  placeholder="Field label"
                  aria-label={`Field ${fIdx + 1} label`}
                  className="col-span-4 min-h-[34px] rounded-lg border border-[#E6E8F0] px-2.5 text-xs text-[#111827]"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) =>
                    updateEmbedField(fIdx, {
                      value: e.target.value,
                    })
                  }
                  placeholder="Field value"
                  aria-label={`Field ${fIdx + 1} value`}
                  className="col-span-5 min-h-[34px] rounded-lg border border-[#E6E8F0] px-2.5 text-xs text-[#111827]"
                />
                <label className="col-span-2 flex items-center justify-center gap-1 text-[11px] text-[#525B70]">
                  <input
                    type="checkbox"
                    checked={Boolean(field.inline)}
                    onChange={(e) =>
                      updateEmbedField(fIdx, {
                        inline: e.target.checked,
                      })
                    }
                    className="accent-[#5865F2]"
                  />
                  <span>Inline</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeEmbedField(fIdx)}
                  aria-label={`Remove field ${fIdx + 1}`}
                  className="col-span-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#525B70] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="embed-footer" className="block text-xs font-semibold text-[#111827]">
              Footer Text (optional)
            </label>
            <input
              id="embed-footer"
              type="text"
              value={primaryEmbed.footer?.text ?? ''}
              onChange={(e) =>
                updatePrimaryEmbed((em) => {
                  const next = { ...em };
                  if (e.target.value) {
                    next.footer = { ...em.footer, text: e.target.value };
                  } else {
                    delete next.footer;
                  }
                  return next;
                })
              }
              placeholder="PulseHook Automated Dispatch"
              className="mt-1.5 min-h-[38px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-sm text-[#111827] focus:border-[#5865F2] focus:outline-none"
            />
          </div>
        </div>
      )}
    </>
  );
}
