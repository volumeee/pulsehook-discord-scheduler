import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { DISCORD_PAYLOAD_PRESETS } from '../../utils/discordTemplates';
import { SPRING_SNAPPY } from '../shared/motion';
import type { DiscordPayloadEditorState } from './useDiscordPayload';
import { VisualPayloadBuilder } from './VisualPayloadBuilder';
import { RawPayloadEditor } from './RawPayloadEditor';

export function PayloadEditor({
  mobileSection,
  editor,
}: {
  mobileSection: 'configure' | 'json' | 'preview';
  editor: DiscordPayloadEditorState;
}) {
  const { jsonError, payloadMode, setPayloadMode, updatePayloadFromVisual } = editor;
  const showRawEditor = mobileSection === 'json' || payloadMode === 'json';

  return (
    <>
      {/* Section 4: Discord Payload Template Builder / JSON Editor */}
      <div className="space-y-4 rounded-2xl border border-[#E6E8F0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-[#111827]">
            4. Discord Payload (JSONB)
          </h3>

          {/* Desktop mode toggle */}
          <div className="hidden items-center gap-1 rounded-lg bg-[#F6F7FB] p-1 lg:inline-flex">
            {(
              [
                { id: 'visual', label: 'Visual Builder' },
                { id: 'json', label: 'Raw JSON' },
              ] as const
            ).map((tab) => {
              const active = payloadMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPayloadMode(tab.id)}
                  className={`relative rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    active ? 'text-[#111827]' : 'text-[#525B70]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="payloadEditorMode"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-md bg-white shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Curated Templates */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-[#525B70]">Presets:</span>
          {DISCORD_PAYLOAD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => updatePayloadFromVisual(preset.payload)}
              disabled={Boolean(jsonError)}
              className="min-h-[32px] rounded-lg border border-[#E6E8F0] bg-[#FAFBFD] px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#111827] transition-colors hover:border-[#5865F2] hover:text-[#5865F2]"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Visual Builder OR Raw JSON */}
        {showRawEditor && <RawPayloadEditor mobileSection={mobileSection} editor={editor} />}
        {jsonError && !showRawEditor && (
          <p className="flex items-center gap-1 text-xs font-medium text-[#DC2626]">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{jsonError} Open JSON to fix the draft before editing.</span>
          </p>
        )}

        {mobileSection !== 'json' && (
          <div className={payloadMode === 'visual' ? 'block' : 'block lg:hidden'}>
            <VisualPayloadBuilder editor={editor} />
          </div>
        )}
      </div>
    </>
  );
}
