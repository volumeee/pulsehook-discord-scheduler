'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { OtpChallengeResponse } from '../../lib/api';
import { formatCountdownMmSs } from '../../utils/time';
import { EASE_SETTLE, SPRING_SNAPPY } from '../shared/motion';
import type { AuthGateState } from './useAuthGate';
import { OTP_LENGTH } from './otpDigits';

interface OtpStepProps {
  auth: AuthGateState;
  challenge: OtpChallengeResponse;
}

export function OtpStep({ auth, challenge }: OtpStepProps) {
  const {
    verifiedSuccess,
    submitting,
    handleBackToCredentials,
    infoMessage,
    errorMessage,
    handleOtpSubmitForm,
    shakeCount,
    digits,
    focusedDigitIndex,
    setFocusedDigitIndex,
    otpInputRefs,
    handleDigitChange,
    handleDigitKeyDown,
    handleDigitPaste,
    expiryLeftSec,
    resendLeftSec,
    resending,
    handleResendCode,
  } = auth;

  return (
    <motion.div
      key="otp-step"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.22, ease: EASE_SETTLE }}
      className="p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF0FF] text-[#5865F2]">
          {verifiedSuccess ? (
            <CheckCircle2 className="h-6 w-6 text-[#15803D]" />
          ) : challenge.purpose === 'email_verification' ? (
            <MailCheck className="h-5 w-5" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
        </div>
        <button
          type="button"
          onClick={handleBackToCredentials}
          disabled={submitting || verifiedSuccess}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827] disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Switch account</span>
        </button>
      </div>

      <h2 className="font-display mt-4 text-lg font-bold tracking-tight text-[#111827]">
        {challenge.purpose === 'email_verification'
          ? 'Verify your email address'
          : 'Enter your 6-digit sign-in code'}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-[#525B70]">
        We sent a one-time code to{' '}
        <span className="font-semibold text-[#111827]">{challenge.maskedEmail}</span> for{' '}
        <span className="font-mono font-semibold text-[#5865F2]">@{challenge.username}</span>. Paste
        all 6 digits or type them below.
      </p>

      <AnimatePresence>
        {infoMessage && !errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              verifiedSuccess
                ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]'
                : 'border-[#E0E4FC] bg-[#F5F6FF] text-[#4338CA]'
            }`}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{infoMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#B91C1C]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleOtpSubmitForm} className="mt-5">
        {/* 6 Tactile Monospace OTP Digit Inputs */}
        <motion.div
          key={shakeCount}
          animate={shakeCount > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.36 }}
          className="grid grid-cols-6 gap-2 sm:gap-2.5"
          aria-label="6-digit verification code"
        >
          {digits.map((digit, idx) => {
            const isFocused = focusedDigitIndex === idx;
            const isFilled = digit.length > 0;
            return (
              <motion.div
                key={idx}
                animate={{
                  scale: isFocused ? 1.04 : 1,
                }}
                transition={SPRING_SNAPPY}
              >
                <input
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={OTP_LENGTH}
                  autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Verification digit ${idx + 1} of ${OTP_LENGTH}`}
                  value={digit}
                  disabled={submitting || verifiedSuccess}
                  onFocus={() => setFocusedDigitIndex(idx)}
                  onBlur={() => setFocusedDigitIndex(null)}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  onPaste={handleDigitPaste}
                  className={`h-[52px] w-full rounded-xl border text-center font-mono text-xl font-bold tabular-nums transition-colors focus:outline-none sm:h-[56px] sm:text-2xl ${
                    verifiedSuccess
                      ? 'border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]'
                      : isFocused
                        ? 'border-[#5865F2] bg-white text-[#111827] ring-2 ring-[#5865F2]/25'
                        : isFilled
                          ? 'border-[#C7CCDB] bg-[#FAFBFD] text-[#111827]'
                          : 'border-[#E6E8F0] bg-[#FAFBFD] text-[#111827]'
                  }`}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Live Expiry + Resend Cooldown Row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            className={`font-mono tabular-nums ${
              expiryLeftSec === 0
                ? 'font-semibold text-[#DC2626]'
                : expiryLeftSec <= 60
                  ? 'font-medium text-[#B45309]'
                  : 'text-[#525B70]'
            }`}
          >
            {expiryLeftSec > 0
              ? `Expires in ${formatCountdownMmSs(expiryLeftSec)}`
              : 'Code expired'}
          </span>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendLeftSec > 0 || resending || verifiedSuccess}
            className="inline-flex min-h-[32px] items-center gap-1.5 font-semibold text-[#5865F2] transition-colors hover:text-[#4752C4] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span className="tabular-nums">
              {resending
                ? 'Sending fresh code…'
                : resendLeftSec > 0
                  ? `Resend in ${resendLeftSec}s`
                  : 'Resend code'}
            </span>
          </button>
        </div>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={submitting || verifiedSuccess || digits.join('').length < OTP_LENGTH}
          className={`mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            verifiedSuccess ? 'bg-[#15803D]' : 'bg-[#5865F2] hover:bg-[#4752C4]'
          }`}
        >
          {verifiedSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Verified — Entering Workspace</span>
            </>
          ) : submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying code…</span>
            </>
          ) : (
            <>
              <span>Verify &amp; Open Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
