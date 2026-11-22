'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AuthStatusResponse } from '../../lib/api';
import { EASE_SETTLE, SPRING_SNAPPY } from '../shared/motion';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import type { AuthGateState } from './useAuthGate';

interface CredentialsStepProps {
  auth: AuthGateState;
  authStatus: AuthStatusResponse | null;
}

export function CredentialsStep({ auth, authStatus }: CredentialsStepProps) {
  const { tab, setTab, errorMessage, setErrorMessage, infoMessage, setInfoMessage } = auth;
  const registrationEnabled = authStatus?.registrationEnabled !== false;

  return (
    <motion.div
      key="credentials-step"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: EASE_SETTLE }}
      className="p-6 sm:p-7"
    >
      {/* Segmented Mode Switcher */}
      {registrationEnabled && (
        <div
          role="group"
          aria-label="Authentication mode"
          className="grid grid-cols-2 gap-1 rounded-xl bg-[#F6F7FB] p-1"
        >
          {(
            [
              { id: 'signin', label: 'Sign In' },
              { id: 'signup', label: 'Sign Up' },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTab(item.id);
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`relative min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active ? 'text-[#111827]' : 'text-[#525B70] hover:text-[#111827]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="authModePill"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Resend configuration notice if missing */}
      {authStatus?.resendConfigured === false && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs text-[#92400E]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Email delivery is not configured on this server yet. Add{' '}
            <code className="font-mono font-semibold">RESEND_API_KEY</code> in{' '}
            <code className="font-mono">.env</code> to enable 6-digit OTP emails.
          </span>
        </div>
      )}

      {/* Info Banner (e.g. after password reset) */}
      <AnimatePresence>
        {infoMessage && !errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#15803D]"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{infoMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#B91C1C]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {!registrationEnabled || tab === 'signin' ? (
          <SignInForm key="signin-form" auth={auth} compact={!registrationEnabled} />
        ) : (
          <SignUpForm key="signup-form" auth={auth} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
