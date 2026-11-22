import { DiscordPreview } from './DiscordPreview';
import type { TaskEditorState } from './useTaskEditor';

export function TaskPreview({ editor }: { editor: TaskEditorState }) {
  const { mobileSection, name, schedule, cronDescription, maxRetry, payloadEditor } = editor;
  const { payload } = payloadEditor;

  return (
    <>
      {/* Right Column: Sticky Live Discord Preview */}
      <div
        className={`border-t border-[#E6E8F0] bg-white p-5 sm:p-6 lg:col-span-5 lg:border-t-0 lg:border-l ${
          mobileSection === 'preview' ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="space-y-4 lg:sticky lg:top-6">
          <div>
            <h3 className="font-display text-sm font-semibold text-[#111827]">
              Live Discord Preview
            </h3>
            <p className="mt-0.5 text-xs text-[#525B70]">
              Updates in real time as you edit fields or raw JSON.
            </p>
          </div>

          <DiscordPreview
            payload={payload}
            channelName={
              name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'webhook-alerts'
            }
          />

          <div className="rounded-xl border border-[#E6E8F0] bg-[#FAFBFD] p-3.5 text-xs text-[#525B70]">
            <div className="flex items-center justify-between font-medium text-[#111827]">
              <span>Schedule</span>
              <span className="font-mono tabular-nums">{schedule}</span>
            </div>
            <p className="mt-1">{cronDescription}</p>
            <div className="mt-2.5 flex items-center justify-between border-t border-[#E6E8F0] pt-2.5 font-medium text-[#111827]">
              <span>Retry Budget</span>
              <span className="font-mono tabular-nums">
                {maxRetry} {maxRetry === 1 ? 'retry' : 'retries'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
