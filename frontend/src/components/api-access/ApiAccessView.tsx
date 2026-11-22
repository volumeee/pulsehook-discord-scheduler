'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import type { SessionPrincipal } from '../../lib/api';
import type { ApiKeyRecord } from '../../types/task';
import { formatRelativePast } from '../../utils/time';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { CopyButton } from '../shared/CopyButton';
import { EASE_SETTLE } from '../shared/motion';
import { ApiReference } from './ApiReference';

interface ApiAccessViewProps {
  principal: SessionPrincipal;
  apiKeys: ApiKeyRecord[];
  loading: boolean;
  error: string | null;
  onRetryLoad: () => void;
  onCreateKey: (name: string) => Promise<string>;
  onRevokeKey: (id: number) => Promise<void>;
  onSignOut: () => void;
}

export function ApiAccessView({
  principal: _principal,
  apiKeys,
  loading,
  error,
  onRetryLoad,
  onCreateKey,
  onRevokeKey,
  onSignOut: _onSignOut,
}: ApiAccessViewProps) {
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [revokingIds, setRevokingIds] = useState<Set<number>>(new Set());
  const [pendingRevoke, setPendingRevoke] = useState<ApiKeyRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (keyName.trim().length < 2) {
      setFormError('Give your API key a clear label (e.g. Postman Local).');
      return;
    }
    setCreating(true);
    try {
      const raw = await onCreateKey(keyName.trim());
      setNewlyCreatedKey(raw);
      setKeyName('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create API key.');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevoke) return;
    const id = pendingRevoke.id;
    setRevokingIds((prev) => new Set(prev).add(id));
    try {
      await onRevokeKey(id);
      setPendingRevoke(null);
    } finally {
      setRevokingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left: Signed-In Account Security + Key Management */}
      <section className="min-w-0 space-y-4 lg:col-span-5">
        {/* Account & Session Security Card (Commented out per user request, kept for reference)
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_SETTLE }}
          className="rounded-2xl border border-[#E6E8F0] bg-white p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#5865F2]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-semibold text-[#111827]">
                  {principal.displayName ||
                    (principal.username
                      ? `@${principal.username}`
                      : principal.keyName)}
                </h2>
                <p className="truncate text-xs text-[#525B70]">
                  {principal.email || 'Authenticated session'}
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onSignOut}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E6E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#525B70] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626] whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </motion.button>
          </div>
          <div className="mt-3.5 border-t border-[#EEF0F6] pt-3 text-xs text-[#525B70]">
            <span className="font-semibold text-[#15803D]">
              Email OTP verified
            </span>
            <span className="mx-1.5 text-[#CBD5E1]" aria-hidden="true">
              ·
            </span>
            <span>HttpOnly cookie session (15m access + 7d rotating refresh)</span>
          </div>
        </motion.div>
        */}

        {/* Create API Key */}
        <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#5865F2]" />
            <h2 className="font-display text-sm font-semibold text-[#111827]">
              Create Automation API Key
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#525B70]">
            Use <code className="font-mono text-[#111827]">X-API-Key</code> in Postman, Thunder
            Client, or CI scripts alongside account login. Keys are stored as SHA-256 hashes—the raw
            secret is shown only once.
          </p>

          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="new-api-key-name"
                className="block text-xs font-semibold text-[#111827]"
              >
                Key Name
              </label>
              <input
                id="new-api-key-name"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Postman Evaluation"
                className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
              />
            </div>
            {formError && <p className="text-xs font-medium text-[#DC2626]">{formError}</p>}
            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={creating}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              <span>{creating ? 'Generating…' : 'Generate API Key'}</span>
            </motion.button>
          </form>

          <AnimatePresence>
            {newlyCreatedKey && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: EASE_SETTLE }}
                className="mt-4 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Save this key now</span>
                  </span>
                  <CopyButton text={newlyCreatedKey} label="Copy Key" copiedLabel="Copied" />
                </div>
                <p className="mt-2 rounded-lg border border-[#DCFCE7] bg-white px-2.5 py-2 font-mono text-xs break-all text-[#111827]">
                  {newlyCreatedKey}
                </p>
                <p className="mt-1.5 text-[11px] text-[#166534]">
                  For security, this secret will not be shown again once you leave this page.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C]">
            <span>{error}</span>
            <button
              type="button"
              onClick={onRetryLoad}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#B91C1C] hover:bg-[#FEE2E2]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Active Keys */}
        <div className="overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white">
          <div className="border-b border-[#E6E8F0] px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold text-[#111827]">
              Active API Keys ({apiKeys.length})
            </h3>
          </div>
          {loading && apiKeys.length === 0 ? (
            <div className="p-5 text-xs text-[#525B70]">Loading keys…</div>
          ) : apiKeys.length === 0 && error ? null : apiKeys.length === 0 ? (
            <div className="p-5 text-xs text-[#525B70]">
              No database-managed API keys yet. Generate one above or configure{' '}
              <code className="font-mono text-[#111827]">API_KEY</code> and{' '}
              <code className="font-mono text-[#111827]">API_KEY_USER_ID</code> in your environment.
            </div>
          ) : (
            <div className="divide-y divide-[#EEF0F6]">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111827]">{k.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-[#525B70] tabular-nums">
                      {k.keyPrefix} · Last used:{' '}
                      {k.lastUsedAt ? formatRelativePast(k.lastUsedAt) : 'Never'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revokingIds.has(k.id)}
                    onClick={() => setPendingRevoke(k)}
                    aria-label={`Revoke API key ${k.name}`}
                    className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-[#E6E8F0] text-[#525B70] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <ApiReference newlyCreatedKey={newlyCreatedKey} />

      <ConfirmDeleteDialog
        open={Boolean(pendingRevoke)}
        title={pendingRevoke ? `Revoke "${pendingRevoke.name}"?` : 'Revoke API key?'}
        description="Any scripts or integrations using this key will immediately receive 401 Unauthorized. This action cannot be undone."
        confirmLabel="Revoke Key"
        busy={pendingRevoke ? revokingIds.has(pendingRevoke.id) : false}
        onCancel={() => setPendingRevoke(null)}
        onConfirm={() => void handleConfirmRevoke()}
      />
    </div>
  );
}
