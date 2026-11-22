'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { EASE_SETTLE } from '../shared/motion';
import { PasswordFeedback, passwordStrengthTextColor } from './PasswordFeedback';
import type { ResetPasswordState } from './useResetPassword';

export function ResetPasswordForm({ state }: { state: ResetPasswordState }) {
  const {
    username,
    maskedEmail,
    errorMessage,
    handleResetSubmit,
    passwordEval,
    showPassword,
    newPassword,
    setNewPassword,
    setShowPassword,
    confirmPassword,
    passwordsMatch,
    setConfirmPassword,
    submitting,
  } = state;

  return (
    <motion.form
      key="ready"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: EASE_SETTLE }}
      onSubmit={handleResetSubmit}
      className="space-y-4"
      noValidate
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF0FF] text-[#5865F2]">
        <KeyRound className="h-5 w-5" />
      </div>

      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">
          Choose a new password
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[#525B70]">
          Setting a new password for{' '}
          <span className="font-mono font-semibold text-[#5865F2]">@{username}</span> ({maskedEmail}
          ). All existing active sessions will be signed out automatically.
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
        <div className="flex items-center justify-between">
          <label
            htmlFor="reset-new-password"
            className="block text-xs font-semibold text-[#111827]"
          >
            New Password
          </label>
          {passwordEval.score > 0 && (
            <span
              className={`text-[11px] font-semibold ${passwordStrengthTextColor(passwordEval.score)}`}
            >
              {passwordEval.label}
            </span>
          )}
        </div>
        <div className="relative mt-1.5">
          <input
            id="reset-new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white py-2 pr-11 pl-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <PasswordFeedback evaluation={passwordEval} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="reset-confirm-password"
            className="block text-xs font-semibold text-[#111827]"
          >
            Confirm New Password
          </label>
          {confirmPassword.length > 0 && (
            <span
              className={`text-[11px] font-medium ${
                passwordsMatch ? 'text-[#15803D]' : 'text-[#DC2626]'
              }`}
            >
              {passwordsMatch ? 'Matches' : 'Does not match'}
            </span>
          )}
        </div>
        <input
          id="reset-confirm-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
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
            <span>Updating password…</span>
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            <span>Update Password</span>
          </>
        )}
      </motion.button>
    </motion.form>
  );
}
