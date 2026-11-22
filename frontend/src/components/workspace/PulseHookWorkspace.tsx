'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Webhook } from 'lucide-react';
import { ApiError, apiClient, type AuthStatusResponse, type SessionPrincipal } from '../../lib/api';
import { AuthGate } from '../auth/AuthGate';
import { ToastStack, type ToastItem } from '../shared/ToastStack';
import { WorkspaceLayout } from './WorkspaceLayout';

interface PulseHookWorkspaceProps {
  initialAuthStatus?: AuthStatusResponse | null;
}

interface WorkspaceSession {
  principal: SessionPrincipal;
  id: number;
}

export function PulseHookWorkspace({ initialAuthStatus = null }: PulseHookWorkspaceProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(initialAuthStatus);
  const [bootChecking, setBootChecking] = useState(true);
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const sessionVersion = useRef(0);
  const toastTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  const pushToast = useCallback((tone: ToastItem['tone'], title: string, detail?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((previous) => [...previous.slice(-3), { id, tone, title, detail }]);
    const timer = window.setTimeout(() => {
      toastTimers.current.delete(id);
      setToasts((previous) => previous.filter((item) => item.id !== id));
    }, 4600);
    toastTimers.current.set(id, timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToasts((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const loadAuthStatus = useCallback(async (version: number) => {
    try {
      const status = await apiClient.getAuthStatus();
      if (sessionVersion.current === version) setAuthStatus(status);
    } catch (error) {
      if (sessionVersion.current !== version) return;
      setSessionNotice(
        error instanceof Error ? error.message : 'Unable to reach PulseHook backend API.'
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    const version = sessionVersion.current;
    const bootstrapSession = async () => {
      try {
        const status = await apiClient.getAuthStatus().catch(() => initialAuthStatus);
        if (!active || sessionVersion.current !== version) return;
        if (status) setAuthStatus(status);
        if (status?.hasSessionCookie) {
          try {
            const me = await apiClient.verifySession();
            if (!active || sessionVersion.current !== version) return;
            if (me?.authenticated) {
              setSession({ principal: me.principal, id: ++sessionVersion.current });
              setSessionNotice(null);
            }
          } catch (error) {
            if (!active || sessionVersion.current !== version) return;
            if (error instanceof ApiError && error.reuseDetected) {
              setSessionNotice(error.message);
            }
          }
        }
      } finally {
        if (active) setBootChecking(false);
      }
    };
    void bootstrapSession();
    return () => {
      active = false;
    };
  }, [initialAuthStatus]);

  const isSessionCurrent = useCallback((id: number) => sessionVersion.current === id, []);

  const handleUnauthorized = useCallback(
    (id: number, error: unknown) => {
      if (sessionVersion.current !== id) return true;
      if (!(error instanceof ApiError) || error.status !== 401) return false;
      const version = ++sessionVersion.current;
      setSession(null);
      setToasts([]);
      setSessionNotice(
        error.reuseDetected
          ? error.message
          : 'Your session expired or was revoked. Sign in again to receive a fresh 6-digit code.'
      );
      void loadAuthStatus(version);
      return true;
    },
    [loadAuthStatus]
  );

  const handleAuthenticated = useCallback(
    (principal: SessionPrincipal) => {
      setSession({ principal, id: ++sessionVersion.current });
      setSessionNotice(null);
      setToasts([]);
      const who =
        principal.displayName || (principal.username ? `@${principal.username}` : 'your account');
      pushToast(
        'success',
        `Signed in as ${who}`,
        'HttpOnly access and rotating refresh cookies are now active.'
      );
    },
    [pushToast]
  );

  const handleSignOut = useCallback(
    async (id: number) => {
      if (sessionVersion.current !== id) return;
      const version = ++sessionVersion.current;
      let signedOut = false;
      try {
        await apiClient.logout();
        signedOut = true;
      } catch {
        // Clear the local session even if logout cannot reach the server.
      }
      if (sessionVersion.current !== version) return;
      setSession(null);
      setSessionNotice(null);
      setToasts([]);
      void loadAuthStatus(version);
      pushToast(
        'info',
        'Signed out',
        signedOut
          ? 'Your session family was revoked and HttpOnly cookies were cleared.'
          : 'The local session was cleared, but the server could not confirm sign out.'
      );
    },
    [loadAuthStatus, pushToast]
  );

  if (bootChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5865F2] text-white shadow-sm">
            <Webhook className="h-5 w-5 animate-pulse" />
          </div>
          <p className="font-display text-sm font-semibold text-[#111827]">
            Connecting to PulseHook…
          </p>
          <p className="text-xs text-[#525B70]">
            Checking API protection and PostgreSQL scheduler status
          </p>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {!session ? (
        <AuthGate
          authStatus={authStatus}
          sessionNotice={sessionNotice}
          onAuthenticated={handleAuthenticated}
        />
      ) : (
        <WorkspaceLayout
          key={session.id}
          principal={session.principal}
          sessionId={session.id}
          isSessionCurrent={isSessionCurrent}
          onUnauthorized={handleUnauthorized}
          onSignOut={handleSignOut}
          pushToast={pushToast}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </MotionConfig>
  );
}
