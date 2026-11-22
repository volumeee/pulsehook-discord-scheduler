'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { ApiError, apiClient, type SessionPrincipal } from '../../lib/api';
import {
  evaluatePasswordStrength,
  isValidEmail,
  isValidUsername,
  type PasswordEvaluation,
} from '../../utils/passwordStrength';
import { useOtpChallenge, type OtpChallengeState } from './useOtpChallenge';

type AuthTab = 'signin' | 'signup';

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface AuthGateState extends OtpChallengeState {
  tab: AuthTab;
  setTab: Setter<AuthTab>;
  identifier: string;
  setIdentifier: Setter<string>;
  loginPassword: string;
  setLoginPassword: Setter<string>;
  showLoginPassword: boolean;
  setShowLoginPassword: Setter<boolean>;
  username: string;
  setUsername: Setter<string>;
  email: string;
  setEmail: Setter<string>;
  signupPassword: string;
  setSignupPassword: Setter<string>;
  confirmPassword: string;
  setConfirmPassword: Setter<string>;
  showSignupPassword: boolean;
  setShowSignupPassword: Setter<boolean>;
  forgotMode: boolean;
  setForgotMode: Setter<boolean>;
  forgotIdentifier: string;
  setForgotIdentifier: Setter<string>;
  forgotSent: boolean;
  setForgotSent: Setter<boolean>;
  forgotCooldownSec: number;
  submitting: boolean;
  errorMessage: string | null;
  setErrorMessage: Setter<string | null>;
  infoMessage: string | null;
  setInfoMessage: Setter<string | null>;
  passwordEval: PasswordEvaluation;
  passwordsMatch: boolean;
  handleSignInSubmit: (event: FormEvent) => Promise<void>;
  handleSignUpSubmit: (event: FormEvent) => Promise<void>;
  handleOpenForgotPassword: () => void;
  handleForgotSubmit: (event: FormEvent) => Promise<void>;
}

export function useAuthGate(
  sessionNotice: string | null,
  onAuthenticated: (principal: SessionPrincipal) => void
): AuthGateState {
  const [tab, setTab] = useState<AuthTab>('signin');

  // Sign In form state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Create Account form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Forgot Password flow state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotCooldownSec, setForgotCooldownSec] = useState(0);

  // Request feedback state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(sessionNotice);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const otp = useOtpChallenge({
    submitting,
    setSubmitting,
    setErrorMessage,
    setInfoMessage,
    onAuthenticated,
  });
  const { startOtpStep } = otp;

  useEffect(() => {
    if (sessionNotice) {
      setErrorMessage(sessionNotice);
    }
  }, [sessionNotice]);

  // Handle deep links returned from /reset-password (?reset=success or ?forgot=1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const resetFlag = params.get('reset');
    const forgotFlag = params.get('forgot');
    if (resetFlag === 'success') {
      setForgotMode(false);
      setTab('signin');
      setErrorMessage(null);
      setInfoMessage(
        'Your password was updated and previous sessions were signed out. Sign in with your new password.'
      );
      window.history.replaceState({}, '', window.location.pathname);
    } else if (forgotFlag === '1') {
      setForgotMode(true);
      setForgotSent(false);
      setErrorMessage(null);
      setInfoMessage(null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Countdown tick for forgot-password resend cooldown
  useEffect(() => {
    if (forgotCooldownSec <= 0) return;
    const interval = window.setInterval(() => {
      setForgotCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [forgotCooldownSec]);

  const passwordEval = useMemo(() => evaluatePasswordStrength(signupPassword), [signupPassword]);

  const passwordsMatch = confirmPassword.length > 0 && signupPassword === confirmPassword;

  const handleSignInSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedId = identifier.trim();
    if (!trimmedId || !loginPassword) {
      setErrorMessage('Enter both your username/email and password to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.login({
        identifier: trimmedId,
        password: loginPassword,
      });
      startOtpStep(res);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not sign in right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!isValidUsername(username)) {
      setErrorMessage(
        'Username must be 3–32 characters using only letters, numbers, or underscores.'
      );
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage(
        'Enter a valid email address so we can deliver your 6-digit verification code.'
      );
      return;
    }
    if (!passwordEval.isValid) {
      setErrorMessage(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
      );
      return;
    }
    if (signupPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Re-enter your confirmation password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.register({
        username: username.trim(),
        email: email.trim(),
        password: signupPassword,
      });
      startOtpStep(res);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not create your account right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setForgotMode(true);
    setForgotSent(false);
    setForgotIdentifier(identifier.trim());
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = forgotIdentifier.trim();
    if (trimmed.length < 2) {
      setErrorMessage('Enter the email address or username linked to your account.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.forgotPassword({ identifier: trimmed });
      setForgotSent(true);
      setForgotCooldownSec(60);
      setInfoMessage(res.message);
    } catch (err) {
      if (err instanceof ApiError && err.retryAfterSeconds) {
        setForgotCooldownSec(err.retryAfterSeconds);
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not send a password reset link right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    tab,
    setTab,
    identifier,
    setIdentifier,
    loginPassword,
    setLoginPassword,
    showLoginPassword,
    setShowLoginPassword,
    username,
    setUsername,
    email,
    setEmail,
    signupPassword,
    setSignupPassword,
    confirmPassword,
    setConfirmPassword,
    showSignupPassword,
    setShowSignupPassword,
    ...otp,
    forgotMode,
    setForgotMode,
    forgotIdentifier,
    setForgotIdentifier,
    forgotSent,
    setForgotSent,
    forgotCooldownSec,
    submitting,
    errorMessage,
    setErrorMessage,
    infoMessage,
    setInfoMessage,
    passwordEval,
    passwordsMatch,
    handleSignInSubmit,
    handleSignUpSubmit,
    handleOpenForgotPassword,
    handleForgotSubmit,
  };
}
