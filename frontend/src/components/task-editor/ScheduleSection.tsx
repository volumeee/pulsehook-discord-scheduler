import { Clock } from 'lucide-react';
import { CRON_PRESETS } from '../../utils/cron';

export function ScheduleSection({
  schedule,
  setSchedule,
  cronValid,
  cronDescription,
  upcomingRuns,
  mobileSection,
}: {
  schedule: string;
  setSchedule: (value: string) => void;
  cronValid: boolean;
  cronDescription: string;
  upcomingRuns: Date[];
  mobileSection: 'configure' | 'json' | 'preview';
}) {
  const cronParts = schedule.trim().split(/\s+/);

  return (
    <>
      {/* Section 2: Human-Friendly Cron Builder */}
      <div
        className={`space-y-4 rounded-2xl border border-[#E6E8F0] bg-white p-4 sm:p-5 ${
          mobileSection === 'json' ? 'hidden lg:block' : 'block'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-[#111827]">2. Cron Schedule</h3>
          <span
            className={`text-xs font-medium ${cronValid ? 'text-[#15803D]' : 'text-[#DC2626]'}`}
          >
            {cronValid ? cronDescription : 'Invalid syntax'}
          </span>
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5">
          {CRON_PRESETS.map((preset) => {
            const selected = schedule.trim() === preset.expression;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSchedule(preset.expression)}
                className={`relative min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  selected
                    ? 'border-[#5865F2] bg-[#EEF0FE] text-[#4752C4]'
                    : 'border-[#E6E8F0] bg-[#FAFBFD] text-[#525B70] hover:border-[#C7CCDB] hover:text-[#111827]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="task-cron-input" className="block text-xs font-semibold text-[#111827]">
            Cron Expression (5-field)
          </label>
          <input
            id="task-cron-input"
            type="text"
            required
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="0 9 * * 1-5"
            className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 font-mono text-sm tracking-wide text-[#111827] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
          />
          <div className="mt-2 grid grid-cols-5 gap-1.5 text-center">
            {['Min', 'Hour', 'Day', 'Month', 'Weekday'].map((partLabel, idx) => (
              <div key={partLabel} className="rounded-lg bg-[#F6F7FB] px-1.5 py-1">
                <div className="font-mono text-xs font-semibold text-[#111827] tabular-nums">
                  {cronParts[idx] || '—'}
                </div>
                <div className="text-[10px] text-[#525B70]">{partLabel}</div>
              </div>
            ))}
          </div>
        </div>

        {upcomingRuns.length > 0 && (
          <div className="rounded-xl bg-[#FAFBFD] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
              <Clock className="h-3.5 w-3.5 text-[#5865F2]" />
              <span>Next 3 scheduled runs</span>
            </div>
            <ul className="mt-2 space-y-1 font-mono text-xs text-[#525B70] tabular-nums">
              {upcomingRuns.map((d, i) => (
                <li key={i}>
                  {i + 1}.{' '}
                  {d.toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
