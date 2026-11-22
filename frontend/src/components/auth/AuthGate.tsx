'use client';

import { AnimatePresence, motion } from 'motion/react';
import type { AuthStatusResponse, SessionPrincipal } from '../../lib/api';
import { AmbientCanvas } from '../shared/AmbientCanvas';
import { EASE_SETTLE } from '../shared/motion';
import { AuthBrandHeader } from './AuthBrandHeader';
import { CredentialsStep } from './CredentialsStep';
import { ForgotPasswordStep } from './ForgotPasswordStep';
import { OtpStep } from './OtpStep';
import { useAuthGate } from './useAuthGate';

interface AuthGateProps {
  authStatus: AuthStatusResponse | null;
  sessionNotice: string | null;
  onAuthenticated: (principal: SessionPrincipal) => void;
}

export function AuthGate({ authStatus, sessionNotice, onAuthenticated }: AuthGateProps) {
  const auth = useAuthGate(sessionNotice, onAuthenticated);
  const { challenge, forgotMode } = auth;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#F6F7FB] px-4 py-8 sm:py-12">
      <AmbientCanvas variant="auth" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: EASE_SETTLE }}
        className="relative z-10 w-full max-w-[444px]"
      >
        <AuthBrandHeader description="Scheduled Discord webhooks with real-time observability" />

        {/* Main Soft Bento Auth Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white shadow-[0_12px_36px_-18px_rgba(17,24,39,0.16)]">
          <AnimatePresence mode="wait" initial={false}>
            {forgotMode && !challenge ? (
              <ForgotPasswordStep key="forgot-password-step" auth={auth} />
            ) : !challenge ? (
              <CredentialsStep key="credentials-step" auth={auth} authStatus={authStatus} />
            ) : (
              <OtpStep key="otp-step" auth={auth} challenge={challenge} />
            )}
          </AnimatePresence>
        </div>

        {/* Quiet Security & Dual-Auth Footer */}
        <p className="mt-5 text-center text-xs leading-relaxed text-[#64748B]">
          Protected by salted password hashing, 6-digit email OTP, and revocable sessions. Manage{' '}
          <span className="font-mono text-[#525B70]">X-API-Key</span> tokens for Postman &amp; CI
          inside API Access after signing in.
        </p>
      </motion.div>
    </div>
  );
}
