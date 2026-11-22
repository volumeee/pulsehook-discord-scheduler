'use client';

import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { isValidUsername } from '../../utils/passwordStrength';
import { EASE_SETTLE } from '../shared/motion';
import { PasswordFeedback, passwordStrengthTextColor } from './PasswordFeedback';
import type { AuthGateState } from './useAuthGate';

export function SignUpForm({ auth }: { auth: AuthGateState }) {
  const {
    handleSignUpSubmit,
    username,
    setUsername,
    email,
    setEmail,
    passwordEval,
    showSignupPassword,
    signupPassword,
    setSignupPassword,
    setShowSignupPassword,
    confirmPassword,
    passwordsMatch,
    setConfirmPassword,
    submitting,
  } = auth;

  return (
    <motion.form
      key="signup-form"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16, ease: EASE_SETTLE }}
      onSubmit={handleSignUpSubmit}
      className="mt-5 space-y-4"
      noValidate
    >
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">Sign up</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[#525B70]">
          Set up your handle and verify your inbox with a 6-digit one-time code.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="signup-username" className="block text-xs font-semibold text-[#111827]">
            Username
          </label>
          {username.trim().length > 0 && (
            <span
              className={`text-[11px] font-medium ${
                isValidUsername(username) ? 'text-[#15803D]' : 'text-[#B45309]'
              }`}
            >
              {isValidUsername(username) ? 'Valid handle' : '3–32 chars (a-z, 0-9, _)'}
            </span>
          )}
        </div>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. bagus_dev"
          className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="signup-email" className="block text-xs font-semibold text-[#111827]">
          Email Address
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="signup-password" className="block text-xs font-semibold text-[#111827]">
            Password
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
            id="signup-password"
            type={showSignupPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white py-2 pr-11 pl-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowSignupPassword((prev) => !prev)}
            aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
          >
            {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <PasswordFeedback evaluation={passwordEval} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="signup-confirm-password"
            className="block text-xs font-semibold text-[#111827]"
          >
            Confirm Password
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
          id="signup-confirm-password"
          type={showSignupPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
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
            <span>Signing up &amp; sending code…</span>
          </>
        ) : (
          <>
            <span>Sign Up &amp; Send Code</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </motion.button>
    </motion.form>
  );
}
