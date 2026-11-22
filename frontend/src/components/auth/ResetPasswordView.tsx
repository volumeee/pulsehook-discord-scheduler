'use client';

import Link from 'next/link';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthBrandHeader } from './AuthBrandHeader';
import { ResetPasswordForm } from './ResetPasswordForm';
import { useResetPassword } from './useResetPassword';
import { AmbientCanvas } from '../shared/AmbientCanvas';
import { EASE_SETTLE } from '../shared/motion';

export function ResetPasswordView() {
  const state = useResetPassword();
  const { phase, errorMessage, successMessage } = state;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#F6F7FB] px-4 py-8 sm:py-12">
        <AmbientCanvas variant="auth" />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_SETTLE }}
          className="relative z-10 w-full max-w-[444px]"
        >
          <AuthBrandHeader description="Account Recovery & Session Security" />

          {/* Soft Bento Card */}
          <div className="overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white p-6 shadow-[0_12px_36px_-18px_rgba(17,24,39,0.16)] sm:p-7">
            <AnimatePresence mode="wait" initial={false}>
              {phase === 'validating' && (
                <motion.div
                  key="validating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-8 text-center"
                >
                  <Loader2 className="h-7 w-7 animate-spin text-[#5865F2]" />
                  <p className="font-display mt-3 text-sm font-semibold text-[#111827]">
                    Verifying your reset link…
                  </p>
                  <p className="mt-1 text-xs text-[#525B70]">
                    Checking single-use token integrity and expiry
                  </p>
                </motion.div>
              )}

              {phase === 'invalid' && (
                <motion.div
                  key="invalid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: EASE_SETTLE }}
                  className="space-y-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">
                      Reset link unavailable
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[#525B70]">
                      {errorMessage ||
                        'This password reset link is invalid, expired, or has already been used.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <Link
                      href="/?forgot=1"
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
                    >
                      <span>Request a new link</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E6E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
                    >
                      Sign In
                    </Link>
                  </div>
                </motion.div>
              )}

              {phase === 'ready' && <ResetPasswordForm key="ready" state={state} />}

              {phase === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22, ease: EASE_SETTLE }}
                  className="space-y-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#15803D]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-[#111827]">
                      Password updated
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[#525B70]">
                      {successMessage ||
                        'Your password has been updated and all previous sessions were signed out.'}
                    </p>
                  </div>
                  <Link
                    href="/?reset=success"
                    className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
                  >
                    <span>Continue to Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-[#64748B]">
            Reset links are hashed with SHA-256, expire in 15 minutes, and can only be used once.
          </p>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
