'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClipboardEvent,
  Dispatch,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SetStateAction,
} from 'react';
import {
  ApiError,
  apiClient,
  type OtpChallengeResponse,
  type SessionPrincipal,
} from '../../lib/api';

import { OTP_LENGTH, pastedOtpDigits, updateOtpDigits } from './otpDigits';
type Setter<T> = Dispatch<SetStateAction<T>>;

export interface OtpChallengeState {
  challenge: OtpChallengeResponse | null;
  digits: string[];
  focusedDigitIndex: number | null;
  setFocusedDigitIndex: Setter<number | null>;
  expiryLeftSec: number;
  resendLeftSec: number;
  shakeCount: number;
  verifiedSuccess: boolean;
  resending: boolean;
  otpInputRefs: RefObject<Array<HTMLInputElement | null>>;
  startOtpStep: (challenge: OtpChallengeResponse) => void;
  handleOtpSubmitForm: (event: FormEvent) => void;
  handleDigitChange: (index: number, value: string) => void;
  handleDigitKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  handleDigitPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  handleResendCode: () => Promise<void>;
  handleBackToCredentials: () => void;
}

interface OtpChallengeOptions {
  submitting: boolean;
  setSubmitting: Setter<boolean>;
  setErrorMessage: Setter<string | null>;
  setInfoMessage: Setter<string | null>;
  onAuthenticated: (principal: SessionPrincipal) => void;
}

export function useOtpChallenge({
  submitting,
  setSubmitting,
  setErrorMessage,
  setInfoMessage,
  onAuthenticated,
}: OtpChallengeOptions): OtpChallengeState {
  // Step 2: 6-digit OTP Challenge state
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedDigitIndex, setFocusedDigitIndex] = useState<number | null>(null);
  const [expiryLeftSec, setExpiryLeftSec] = useState(0);
  const [resendLeftSec, setResendLeftSec] = useState(0);
  const [shakeCount, setShakeCount] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };
  }, []);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastSubmittedCodeRef = useRef<string | null>(null);
  // Countdown tick for OTP expiry & resend cooldown
  useEffect(() => {
    if (!challenge) return;
    const interval = window.setInterval(() => {
      setExpiryLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
      setResendLeftSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [challenge]);
  // Auto-focus first OTP input whenever a new challenge begins
  useEffect(() => {
    if (challenge) {
      const id = window.setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 120);
      return () => window.clearTimeout(id);
    }
  }, [challenge]);
  const startOtpStep = (nextChallenge: OtpChallengeResponse) => {
    setChallenge(nextChallenge);
    setDigits(Array(OTP_LENGTH).fill(''));
    setExpiryLeftSec(nextChallenge.expiresInSeconds || 300);
    setResendLeftSec(nextChallenge.resendCooldownSeconds || 60);
    setErrorMessage(null);
    setInfoMessage(nextChallenge.message);
    setVerifiedSuccess(false);
    lastSubmittedCodeRef.current = null;
  };
  const submitOtpCode = useCallback(
    async (codeStr: string) => {
      if (!challenge || submitting || verifiedSuccess) return;
      if (codeStr.length !== OTP_LENGTH) {
        setErrorMessage('Enter all 6 digits from your verification email.');
        return;
      }
      if (expiryLeftSec <= 0) {
        setErrorMessage('This verification code has expired. Click Resend code for a fresh one.');
        return;
      }

      setSubmitting(true);
      setErrorMessage(null);
      lastSubmittedCodeRef.current = codeStr;

      try {
        const res = await apiClient.verifyOtp({
          challengeToken: challenge.challengeToken,
          code: codeStr,
        });
        setVerifiedSuccess(true);
        setInfoMessage('Code verified — opening your PulseHook workspace…');
        timersRef.current.push(
          window.setTimeout(() => {
            onAuthenticated(res.principal);
          }, 420)
        );
      } catch (err) {
        setShakeCount((prev) => prev + 1);
        const msg =
          err instanceof Error
            ? err.message
            : 'Invalid verification code. Please check your inbox and try again.';
        setErrorMessage(msg);
        if (err instanceof ApiError && err.attemptsRemaining === 0) {
          setDigits(Array(OTP_LENGTH).fill(''));
        }
        timersRef.current.push(
          window.setTimeout(() => {
            otpInputRefs.current[OTP_LENGTH - 1]?.focus();
          }, 80)
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      challenge,
      expiryLeftSec,
      onAuthenticated,
      submitting,
      verifiedSuccess,
      setErrorMessage,
      setInfoMessage,
      setSubmitting,
    ]
  );

  const handleOtpSubmitForm = (e: FormEvent) => {
    e.preventDefault();
    void submitOtpCode(digits.join(''));
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    if (submitting || verifiedSuccess) return;
    const cleaned = rawValue.replace(/\D/g, '');

    if (!cleaned) {
      setDigits((prev) => updateOtpDigits(prev, index, ''));
      lastSubmittedCodeRef.current = null;
      return;
    }

    // Handle multi-digit paste or OS one-time-code autofill
    if (cleaned.length > 1) {
      const next = updateOtpDigits(digits, index, cleaned);
      const cursor = Math.min(index + cleaned.length, OTP_LENGTH);
      setDigits(next);
      setErrorMessage(null);
      const nextFocus = Math.min(cursor, OTP_LENGTH - 1);
      otpInputRefs.current[nextFocus]?.focus();

      const full = next.join('');
      if (full.length === OTP_LENGTH && full !== lastSubmittedCodeRef.current) {
        void submitOtpCode(full);
      }
      return;
    }

    const next = updateOtpDigits(digits, index, cleaned);
    setDigits(next);
    setErrorMessage(null);

    if (index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === OTP_LENGTH && full !== lastSubmittedCodeRef.current) {
      void submitOtpCode(full);
    }
  };

  const handleDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        e.preventDefault();
        const next = [...digits];
        next[index] = '';
        setDigits(next);
        lastSubmittedCodeRef.current = null;
      } else if (index > 0) {
        e.preventDefault();
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        lastSubmittedCodeRef.current = null;
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted.length >= 2) {
      e.preventDefault();
      const next = pastedOtpDigits(pasted);
      setDigits(next);
      setErrorMessage(null);
      const filledCount = Math.min(pasted.length, OTP_LENGTH);
      otpInputRefs.current[Math.min(filledCount, OTP_LENGTH - 1)]?.focus();
      const full = next.join('');
      if (full.length === OTP_LENGTH) {
        void submitOtpCode(full);
      }
    }
  };

  const handleResendCode = async () => {
    if (!challenge || resending || resendLeftSec > 0) return;
    setResending(true);
    setErrorMessage(null);
    try {
      const fresh = await apiClient.resendOtp({
        challengeToken: challenge.challengeToken,
      });
      startOtpStep(fresh);
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds) {
        setResendLeftSec(err.retryAfterSeconds);
      }
      setErrorMessage(err instanceof Error ? err.message : 'Could not resend verification code.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToCredentials = () => {
    setChallenge(null);
    setDigits(Array(OTP_LENGTH).fill(''));
    setErrorMessage(null);
    setInfoMessage(null);
    setVerifiedSuccess(false);
    lastSubmittedCodeRef.current = null;
  };
  return {
    challenge,
    digits,
    focusedDigitIndex,
    setFocusedDigitIndex,
    expiryLeftSec,
    resendLeftSec,
    shakeCount,
    verifiedSuccess,
    resending,
    otpInputRefs,
    startOtpStep,
    handleOtpSubmitForm,
    handleDigitChange,
    handleDigitKeyDown,
    handleDigitPaste,
    handleResendCode,
    handleBackToCredentials,
  };
}
