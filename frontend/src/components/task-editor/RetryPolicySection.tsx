import type { TaskStatus } from '../../types/task';
import { describeRetryPolicy } from '../../utils/cron';
import type { TaskEditorState } from './useTaskEditor';

export function RetryPolicySection({ editor }: { editor: TaskEditorState }) {
  const { mobileSection, maxRetry, setMaxRetry, retryDelayMs, setRetryDelayMs, status, setStatus } =
    editor;

  return (
    <>
      {/* Section 3: Retry Policy & Initial State */}
      <div
        className={`space-y-4 rounded-2xl border border-[#E6E8F0] bg-white p-4 sm:p-5 ${
          mobileSection === 'json' ? 'hidden lg:block' : 'block'
        }`}
      >
        <h3 className="font-display text-sm font-semibold text-[#111827]">
          3. Resilience &amp; Retry Policy
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="task-max-retry" className="block text-xs font-semibold text-[#111827]">
              Max Retries (0–10)
            </label>
            <input
              id="task-max-retry"
              type="number"
              min={0}
              max={10}
              value={maxRetry}
              onChange={(e) => setMaxRetry(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
              className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 font-mono text-sm text-[#111827] tabular-nums focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="task-retry-delay"
              className="block text-xs font-semibold text-[#111827]"
            >
              Base Backoff
            </label>
            <select
              id="task-retry-delay"
              value={retryDelayMs}
              onChange={(e) => setRetryDelayMs(Number(e.target.value))}
              className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-sm text-[#111827] focus:border-[#5865F2] focus:outline-none"
            >
              <option value={500}>500 ms</option>
              <option value={1000}>1 second</option>
              <option value={1500}>1.5 seconds</option>
              <option value={2000}>2 seconds</option>
              <option value={5000}>5 seconds</option>
              {![500, 1000, 1500, 2000, 5000].includes(retryDelayMs) && (
                <option value={retryDelayMs}>{retryDelayMs} ms (custom)</option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-initial-status"
              className="block text-xs font-semibold text-[#111827]"
            >
              Schedule State
            </label>
            <select
              id="task-initial-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3 text-sm text-[#111827] focus:border-[#5865F2] focus:outline-none"
            >
              <option value="active">Active (Armed)</option>
              <option value="paused">Paused (Draft)</option>
              {status === 'failed' && <option value="failed">Failed (Needs Attention)</option>}
            </select>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#525B70]">
          {describeRetryPolicy(maxRetry, retryDelayMs)}
        </p>
      </div>
    </>
  );
}
