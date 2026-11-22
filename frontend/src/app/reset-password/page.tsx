import type { Metadata } from 'next';
import { ResetPasswordView } from '@/components/auth/ResetPasswordView';

export const metadata: Metadata = {
  title: 'Reset Password — PulseHook',
  description: 'Set a new password for your PulseHook Discord webhook workspace.',
};

export default function ResetPasswordPage() {
  return <ResetPasswordView />;
}
