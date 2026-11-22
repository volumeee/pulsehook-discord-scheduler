import { Check, Wand2 } from 'lucide-react';
import type { TaskEditorSection } from './useTaskEditor';
import type { DiscordPayloadEditorState } from './useDiscordPayload';

export function RawPayloadEditor({
  mobileSection,
  editor,
}: {
  mobileSection: TaskEditorSection;
  editor: DiscordPayloadEditorState;
}) {
  const { rawJson, jsonError, handleRawJsonChange, handleFormatJson } = editor;

  return (
    <>
      <div
        className={mobileSection === 'json' ? 'block space-y-2.5' : 'hidden space-y-2.5 lg:block'}
      >
        <div className="flex items-center justify-between">
          <label htmlFor="raw-json-editor" className="text-xs font-semibold text-[#111827]">
            Discord Webhook JSON Body
          </label>
          <button
            type="button"
            onClick={handleFormatJson}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E6E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#F6F7FB]"
          >
            <Wand2 className="h-3 w-3 text-[#5865F2]" />
            <span>Format JSON</span>
          </button>
        </div>
        <textarea
          id="raw-json-editor"
          rows={12}
          value={rawJson}
          onChange={(e) => handleRawJsonChange(e.target.value)}
          spellCheck={false}
          className="w-full rounded-xl border border-[#E6E8F0] bg-[#FAFBFD] p-3.5 font-mono text-xs leading-relaxed text-[#111827] focus:border-[#5865F2] focus:bg-white focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
        />
        {jsonError ? (
          <p className="text-xs font-medium text-[#DC2626]">{jsonError}</p>
        ) : (
          <p className="inline-flex items-center gap-1 text-xs text-[#15803D]">
            <Check className="h-3.5 w-3.5" />
            <span>Valid Discord JSONB payload</span>
          </p>
        )}
      </div>
    </>
  );
}
