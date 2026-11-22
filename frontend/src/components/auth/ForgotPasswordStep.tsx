'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import { EASE_SETTLE } from '../shared/motion';
import type { AuthGateState } from './useAuthGate';

export function ForgotPasswordStep({ auth }: { auth: AuthGateState }) {
  const {
    forgotSent,
    setForgotMode,
    setForgotSent,
    errorMessage,
    setErrorMessage,
    infoMessage,
    setInfoMessage,
    forgotIdentifier,
    setForgotIdentifier,
    handleForgotSubmit,
    submitting,
    forgotCooldownSec,
  } = auth;

  return (
    <motion.div
      key="forgot-password-step"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: EASE_SETTLE }}
      className="p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF0FF] text-[#5865F2]">
          {forgotSent ? (
            <MailCheck className="h-5 w-5 text-[#15803D]" />
          ) : (
            <KeyRound className="h-5 w-5" />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setForgotMode(false);
            setForgotSent(false);
            setErrorMessage(null);
            setInfoMessage(null);
          }}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </button>
      </div>

      {!forgotSent ? (
        <form onSubmit={handleForgotSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">
              Reset your password
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#525B70]">
              Enter your email address or username. We&apos;ll send a single-use reset link valid
              for 15 minutes.
            </p>
          </div>

          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#B91C1C]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label
              htmlFor="forgot-identifier"
              className="block text-xs font-semibold text-[#111827]"
            >
              Username or Email
            </label>
            <input
              id="forgot-identifier"
              type="text"
              autoComplete="username"
              value={forgotIdentifier}
              onChange={(e) => setForgotIdentifier(e.target.value)}
              placeholder="e.g. bagose or you@domain.com"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
            />
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            disabled={submitting}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending reset link…</span>
              </>
            ) : (
              <>
                <span>Send Reset Link</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">
              Check your inbox
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#525B70]">
              {infoMessage ||
                "If an account matches that email or username, we've sent a password reset link."}
            </p>
          </div>

          <div className="rounded-xl border border-[#E6E8F0] bg-[#F6F7FB] p-3.5 text-xs leading-relaxed text-[#525B70]">
            The reset link expires in{' '}
            <span className="font-semibold text-[#111827]">15 minutes</span> and can only be used
            once. Completing a reset automatically signs out all existing sessions.
          </div>
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={forgotCooldownSec > 0 || submitting}
              onClick={(e) => void handleForgotSubmit(e)}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-[#5865F2] transition-colors hover:text-[#4752C4] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${submitting ? 'animate-spin' : ''}`} />
              <span className="tabular-nums">
                {forgotCooldownSec > 0 ? `Resend in ${forgotCooldownSec}s` : 'Send another link'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setForgotSent(false);
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#E6E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#111827] transition-colors hover:bg-[#F6F7FB]"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
