'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { ApiError, apiClient } from '../../lib/api';
import { evaluatePasswordStrength, type PasswordEvaluation } from '../../utils/passwordStrength';
import { captureResetToken, clearResetToken } from './resetToken';

type ResetPhase = 'validating' | 'ready' | 'invalid' | 'success';
type Setter<T> = Dispatch<SetStateAction<T>>;

export interface ResetPasswordState {
  phase: ResetPhase;
  username: string;
  maskedEmail: string;
  newPassword: string;
  setNewPassword: Setter<string>;
  confirmPassword: string;
  setConfirmPassword: Setter<string>;
  showPassword: boolean;
  setShowPassword: Setter<boolean>;
  submitting: boolean;
  errorMessage: string | null;
  successMessage: string;
  passwordEval: PasswordEvaluation;
  passwordsMatch: boolean;
  handleResetSubmit: (event: FormEvent) => Promise<void>;
}

export function useResetPassword(): ResetPasswordState {
  const [phase, setPhase] = useState<ResetPhase>('validating');
  const [token, setToken] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const passwordEval = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rawToken = captureResetToken(window);

    if (!rawToken || !rawToken.startsWith('ph_rst_')) {
      clearResetToken(window);
      setPhase('invalid');
      setErrorMessage(
        'This password reset link is missing or malformed. Request a fresh link to continue.'
      );
      return;
    }

    setToken(rawToken);
    let active = true;

    apiClient
      .validateResetToken({ token: rawToken })
      .then((res) => {
        if (!active) return;
        setUsername(res.username);
        setMaskedEmail(res.maskedEmail);
        setPhase('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          clearResetToken(window);
          setToken('');
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'This password reset link has expired or already been used.'
        );
        setPhase('invalid');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!passwordEval.isValid) {
      setErrorMessage(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Re-enter your new password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.resetPassword({
        token,
        newPassword,
      });
      setSuccessMessage(res.message);
      clearResetToken(window);
      setToken('');
      setNewPassword('');
      setConfirmPassword('');
      setPhase('success');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not update your password. Request a new reset link and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    phase,
    username,
    maskedEmail,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    submitting,
    errorMessage,
    successMessage,
    passwordEval,
    passwordsMatch,
    handleResetSubmit,
  };
}
