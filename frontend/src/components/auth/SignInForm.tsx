'use client';

import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { EASE_SETTLE } from '../shared/motion';
import type { AuthGateState } from './useAuthGate';

export function SignInForm({ auth, compact = false }: { auth: AuthGateState; compact?: boolean }) {
  const {
    handleSignInSubmit,
    identifier,
    setIdentifier,
    handleOpenForgotPassword,
    showLoginPassword,
    loginPassword,
    setLoginPassword,
    setShowLoginPassword,
    submitting,
  } = auth;

  return (
    <motion.form
      key="signin-form"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16, ease: EASE_SETTLE }}
      onSubmit={handleSignInSubmit}
      className={compact ? 'space-y-4' : 'mt-5 space-y-4'}
      noValidate
    >
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">
          Welcome back
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[#525B70]">
          Sign in with your account. We&apos;ll email a 6-digit security code to verify your
          session.
        </p>
      </div>

      <div>
        <label htmlFor="signin-identifier" className="block text-xs font-semibold text-[#111827]">
          Username or Email
        </label>
        <input
          id="signin-identifier"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="e.g. bagus or you@domain.com"
          className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white px-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="signin-password" className="block text-xs font-semibold text-[#111827]">
            Password
          </label>
          <button
            type="button"
            onClick={handleOpenForgotPassword}
            className="text-xs font-semibold text-[#5865F2] transition-colors hover:text-[#4752C4]"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative mt-1.5">
          <input
            id="signin-password"
            type={showLoginPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Enter your password"
            className="min-h-[44px] w-full rounded-xl border border-[#E6E8F0] bg-white py-2 pr-11 pl-3.5 text-sm text-[#111827] transition-colors placeholder:text-[#9CA3AF] focus:border-[#5865F2] focus:ring-2 focus:ring-[#5865F2]/20 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowLoginPassword((prev) => !prev)}
            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
          >
            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
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
            <span>Sending verification code…</span>
          </>
        ) : (
          <>
            <span>Continue to Verification</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </motion.button>
    </motion.form>
  );
}
