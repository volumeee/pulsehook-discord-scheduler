import { headers } from 'next/headers';
import { PulseHookWorkspace } from '@/components/workspace/PulseHookWorkspace';
import type { AuthStatusResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function getInitialAuthStatus(): Promise<AuthStatusResponse | null> {
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5001';
  const reqHeaders = await headers();
  const cookie = reqHeaders.get('cookie');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${backendUrl}/api/auth/status`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: cookie ? { cookie } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthStatusResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function HomePage() {
  const initialAuthStatus = await getInitialAuthStatus();
  return <PulseHookWorkspace initialAuthStatus={initialAuthStatus} />;
}
