import type { TaskEditorState } from './useTaskEditor';

export function DestinationSection({ editor }: { editor: TaskEditorState }) {
  const { mobileSection, name, setName, webhookUrl, setWebhookUrl } = editor;

  return (
    <>
      {/* Section 1: Essentials & Webhook */}
      <div
        className={`space-y-4 rounded-2xl border border-[#E6E8F0] bg-white p-4 sm:p-5 ${
          mobileSection === 'json' ? 'hidden lg:block' : 'block'
        }`}
      >
        <h3 className="font-display text-sm font-semibold text-[#111827]">
          1. Destination &amp; Identity
        </h3>

        <div>
          <label htmlFor="task-name-input" className="block text-xs font-semibold text-[#111827]">
            Task Name
          </label>
          <input
            id="task-name-input"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Engineering Standup"
            className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="task-webhook-input"
            className="block text-xs font-semibold text-[#111827]"
          >
            Discord Webhook URL
          </label>
          <input
            id="task-webhook-input"
            type="url"
            required
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/123456789012345678/..."
            className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 font-mono text-xs text-[#111827] placeholder:font-sans placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-[#525B70]">
            In Discord: Channel Settings → Integrations → Webhooks → Copy Webhook URL.
          </p>
        </div>
      </div>
    </>
  );
}
