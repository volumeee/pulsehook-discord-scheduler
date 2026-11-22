'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot } from 'lucide-react';
import type { DiscordWebhookPayload } from '../../types/task';
import { decimalToHexColor } from '../../utils/discordTemplates';
import { EASE_SETTLE } from '../shared/motion';

export function DiscordPreview({
  payload,
  channelName = 'deployments',
}: {
  payload: DiscordWebhookPayload;
  channelName?: string;
}) {
  const botName = payload.username?.trim() || 'PulseHook Bot';
  const nowLabel = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const [syncPulse, setSyncPulse] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const avatarUrl = payload.avatar_url?.trim() || '';
  useEffect(() => {
    setSyncPulse(true);
    const id = window.setTimeout(() => setSyncPulse(false), 550);
    return () => window.clearTimeout(id);
  }, [payloadKey]);

  const hasContent = Boolean(payload.content && payload.content.trim().length > 0);
  const embeds = payload.embeds ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2B2D31] bg-[#313338] text-[#DBDEE1]">
      {/* Authentic Discord channel header */}
      <div className="flex items-center justify-between border-b border-[#26282C] bg-[#2B2D31] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-[#B5BAC1]">
          <span className="font-mono text-sm text-[#80848E]">#</span>
          <span className="text-[#F2F3F5]">{channelName}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#949BA4]">
          <motion.span
            animate={{
              scale: syncPulse ? 1.45 : 1,
              opacity: syncPulse ? 1 : 0.75,
            }}
            transition={{ duration: 0.22 }}
            className="h-1.5 w-1.5 rounded-full bg-[#23A55A]"
          />
          <span>Synced live</span>
        </span>
      </div>

      {/* Message Body */}
      <div className="p-4">
        <div className="flex items-start gap-3.5">
          {/* Bot Avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5865F2] text-white">
            {avatarUrl && failedAvatarUrl !== avatarUrl ? (
              <img
                src={avatarUrl}
                alt={botName}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
                onError={() => setFailedAvatarUrl(avatarUrl)}
              />
            ) : (
              <Bot className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* Bot name + APP label + timestamp */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-[#F2F3F5]">{botName}</span>
              <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                APP
              </span>
              <span className="text-[11px] text-[#949BA4] tabular-nums">Today at {nowLabel}</span>
            </div>

            {/* Plain content */}
            {hasContent && (
              <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-[#DBDEE1]">
                {payload.content}
              </p>
            )}

            {/* Empty placeholder when neither content nor embeds */}
            {!hasContent && embeds.length === 0 && (
              <p className="mt-1 text-xs text-[#949BA4] italic">
                Add message content or an embed to preview how it lands in Discord.
              </p>
            )}

            {/* Embeds */}
            <AnimatePresence initial={false}>
              {embeds.map((embed, idx) => {
                const accentHex = decimalToHexColor(embed.color);
                const fields = embed.fields ?? [];

                return (
                  <motion.div
                    key={idx}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: EASE_SETTLE }}
                    className="mt-2.5 max-w-[460px] overflow-hidden rounded bg-[#2B2D31]"
                    style={{
                      boxShadow: `inset 4px 0 0 0 ${accentHex}`,
                    }}
                  >
                    <div className="py-3 pr-4 pl-4">
                      {embed.title && (
                        <p className="text-sm font-semibold break-words text-[#F2F3F5]">
                          {embed.title}
                        </p>
                      )}
                      {embed.description && (
                        <p className="mt-1.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-[#DBDEE1]">
                          {embed.description}
                        </p>
                      )}

                      {fields.length > 0 && (
                        <div className="mt-3 grid grid-cols-12 gap-2.5">
                          {fields.map((field, fIdx) => (
                            <motion.div
                              key={`${fIdx}-${field.name}`}
                              layout
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.14 }}
                              className={field.inline ? 'col-span-6' : 'col-span-12'}
                            >
                              <p className="text-xs font-semibold break-words text-[#F2F3F5]">
                                {field.name || 'Field'}
                              </p>
                              <p className="mt-0.5 text-xs break-words whitespace-pre-wrap text-[#DBDEE1]">
                                {field.value || '—'}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {embed.footer?.text && (
                        <p className="mt-3 text-[11px] text-[#949BA4]">{embed.footer.text}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
