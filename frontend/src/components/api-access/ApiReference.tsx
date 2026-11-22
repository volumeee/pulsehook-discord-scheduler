'use client';

import { CopyButton } from '../shared/CopyButton';

export function ApiReference({ newlyCreatedKey }: { newlyCreatedKey: string | null }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const sampleKeyValue = newlyCreatedKey || 'YOUR_API_KEY';

  const endpoints = [
    {
      method: 'POST',
      path: '/api/auth/register',
      summary: 'Create an account and dispatch a 6-digit email verification OTP via Resend',
      curl: `curl -s -X POST "${origin}/api/auth/register" \\\n  -H "Content-Type: application/json" \\\n  -d '{"username":"bagus_dev","email":"you@example.com","password":"StrongPassword9"}'`,
    },
    {
      method: 'POST',
      path: '/api/auth/verify-otp',
      summary:
        'Verify a 6-digit email or 2FA OTP challenge and receive HttpOnly access + rotating refresh cookies',
      curl: `curl -i -c cookies.txt -X POST "${origin}/api/auth/verify-otp" \\\n  -H "Content-Type: application/json" \\\n  -H "X-Requested-With: PulseHook" \\\n  -d '{"challengeToken":"ph_otp_...","code":"123456"}'`,
    },
    {
      method: 'POST',
      path: '/api/auth/refresh',
      summary:
        'Rotate the HttpOnly refresh cookie and mint a fresh 15-minute access cookie (with reuse detection)',
      curl: `curl -i -b cookies.txt -c cookies.txt -X POST "${origin}/api/auth/refresh" \\\n  -H "X-Requested-With: PulseHook"`,
    },
    {
      method: 'POST',
      path: '/api/auth/forgot-password',
      summary:
        'Send a single-use 15-minute password reset email link with anti-enumeration protection',
      curl: `curl -s -X POST "${origin}/api/auth/forgot-password" \\\n  -H "Content-Type: application/json" \\\n  -d '{"identifier":"you@example.com"}'`,
    },
    {
      method: 'GET',
      path: '/api/dashboard/summary',
      summary: 'Fetch KPI counts, delivery success rate, upcoming tasks, and recent logs',
      curl: `curl -s "${origin}/api/dashboard/summary" \\\n  -H "X-API-Key: ${sampleKeyValue}"`,
    },
    {
      method: 'GET',
      path: '/api/tasks',
      summary: 'List all scheduled Discord webhook tasks (supports ?status= & ?search=)',
      curl: `curl -s "${origin}/api/tasks" \\\n  -H "X-API-Key: ${sampleKeyValue}"`,
    },
    {
      method: 'POST',
      path: '/api/tasks',
      summary: 'Create a new scheduled task with JSONB Discord payload',
      curl: `curl -s -X POST "${origin}/api/tasks" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${sampleKeyValue}" \\\n  -d '{"name":"Release Ping","schedule":"0 9 * * 1-5","webhookUrl":"https://discord.com/api/webhooks/123456789012345678/token_here","maxRetry":3,"payload":{"content":"Task executed successfully!","username":"Task Bot","embeds":[{"title":"Task Completed","description":"Task #123 has been completed","color":3066993}]}}'`,
    },
    {
      method: 'POST',
      path: '/api/tasks/:id/run',
      summary: 'Trigger immediate webhook dispatch through the retry & logging engine',
      curl: `curl -s -X POST "${origin}/api/tasks/1/run" \\\n  -H "X-API-Key: ${sampleKeyValue}"`,
    },
    {
      method: 'GET',
      path: '/api/logs',
      summary: 'Query persisted execution logs (supports ?taskId= & ?status=)',
      curl: `curl -s "${origin}/api/logs?limit=25" \\\n  -H "X-API-Key: ${sampleKeyValue}"`,
    },
  ];

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white lg:col-span-7">
      <div className="border-b border-[#E6E8F0] px-5 py-4">
        <h2 className="font-display text-sm font-semibold text-[#111827]">
          REST API Reference (Postman / Thunder Client / curl)
        </h2>
        <p className="mt-0.5 text-xs text-[#525B70]">
          Workspace endpoints accept either a browser{' '}
          <code className="font-mono text-[#111827]">HttpOnly</code> cookie session (with{' '}
          <code className="font-mono text-[#111827]">X-Requested-With: PulseHook</code>) or an{' '}
          <code className="font-mono text-[#111827]">X-API-Key</code> header.
        </p>
      </div>

      <div className="divide-y divide-[#EEF0F6]">
        {endpoints.map((ep) => (
          <div key={`${ep.method}-${ep.path}`} className="min-w-0 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                <span
                  className={`shrink-0 font-mono font-bold ${
                    ep.method === 'POST' ? 'text-[#5865F2]' : 'text-[#15803D]'
                  }`}
                >
                  {ep.method}
                </span>
                <code className="truncate font-mono font-semibold text-[#111827]">{ep.path}</code>
              </div>
              <CopyButton
                text={ep.curl}
                label="Copy curl"
                copiedLabel="Copied"
                ariaLabel={`Copy curl for ${ep.method} ${ep.path}`}
              />
            </div>
            <p className="mt-1.5 text-xs text-[#525B70]">{ep.summary}</p>
            <pre className="mt-2.5 max-w-full overflow-x-auto rounded-xl bg-[#111827] p-3 font-mono text-[11px] leading-relaxed text-[#E5E7EB]">
              <code>{ep.curl}</code>
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}
