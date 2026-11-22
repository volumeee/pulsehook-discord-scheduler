import type {
  AuthStatusResponse,
  ForgotPasswordResponse,
  OtpChallengeResponse,
  RefreshSessionResponse,
  ResetPasswordResponse,
  SessionPrincipal,
  ValidateResetTokenResponse,
  VerifyOtpResponse,
} from '../types/auth';
import type {
  ApiKeyRecord,
  CreateTaskInput,
  DashboardSummary,
  LogPage,
  RunTaskOutcome,
  TaskRecord,
  UpdateTaskInput,
} from '../types/task';

export type {
  AuthStatusResponse,
  ForgotPasswordResponse,
  OtpChallengeResponse,
  RefreshSessionResponse,
  ResetPasswordResponse,
  SessionPrincipal,
  ValidateResetTokenResponse,
  VerifyOtpResponse,
} from '../types/auth';
export type { RunTaskOutcome } from '../types/task';

export class ApiError extends Error {
  status: number;
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
  reuseDetected?: boolean;

  constructor(
    message: string,
    status: number,
    meta?: {
      attemptsRemaining?: number;
      retryAfterSeconds?: number;
      reuseDetected?: boolean;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.attemptsRemaining = meta?.attemptsRemaining;
    this.retryAfterSeconds = meta?.retryAfterSeconds;
    this.reuseDetected = meta?.reuseDetected;
  }
}

const CSRF_HEADER_NAME = 'X-Requested-With';
const CSRF_HEADER_VALUE = 'PulseHook';

// Single-flight deduplication so parallel 401s never race and trigger refresh-token reuse detection
interface RefreshAttemptResult {
  ok: boolean;
  error?: ApiError;
}

let inFlightRefresh: Promise<RefreshAttemptResult> | null = null;

function parseApiError(status: number, text: string): ApiError {
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { error: text };
    }
  }
  const msg =
    typeof parsed.error === 'string' ? parsed.error : `Request failed with HTTP ${status}`;
  return new ApiError(msg, status, {
    attemptsRemaining:
      typeof parsed.attemptsRemaining === 'number' ? parsed.attemptsRemaining : undefined,
    retryAfterSeconds:
      typeof parsed.retryAfterSeconds === 'number' ? parsed.retryAfterSeconds : undefined,
    reuseDetected: typeof parsed.reuseDetected === 'boolean' ? parsed.reuseDetected : undefined,
  });
}

async function attemptSilentRefresh(): Promise<RefreshAttemptResult> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
        },
      });
      if (res.ok) return { ok: true };
      const text = await res.text();
      return { ok: false, error: parseApiError(res.status, text) };
    } catch {
      return { ok: false };
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

async function requestJson<T>(
  path: string,
  options: RequestInit & {
    skipAuth?: boolean;
    skipRefreshRetry?: boolean;
    _retried?: boolean;
  } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  });

  // Transparently rotate short-lived access cookie via HttpOnly refresh cookie on 401
  if (
    response.status === 401 &&
    !options.skipAuth &&
    !options.skipRefreshRetry &&
    !options._retried
  ) {
    const refreshed = await attemptSilentRefresh();
    if (refreshed.ok) {
      return requestJson<T>(path, { ...options, _retried: true });
    }
    if (refreshed.error?.reuseDetected) {
      throw refreshed.error;
    }
  }

  const text = await response.text();
  if (!response.ok) {
    throw parseApiError(response.status, text);
  }

  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: text } as T;
  }
}

export const apiClient = {
  getAuthStatus: () =>
    requestJson<AuthStatusResponse>('/api/auth/status', {
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  register: (payload: { username: string; email: string; password: string }) =>
    requestJson<OtpChallengeResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  login: (payload: { identifier: string; password: string }) =>
    requestJson<OtpChallengeResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  verifyOtp: (payload: { challengeToken: string; code: string }) =>
    requestJson<VerifyOtpResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  resendOtp: (payload: { challengeToken: string }) =>
    requestJson<OtpChallengeResponse>('/api/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  refreshSession: () =>
    requestJson<RefreshSessionResponse>('/api/auth/refresh', {
      method: 'POST',
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  logout: () =>
    requestJson<{ signedOut: boolean; revoked: boolean }>('/api/auth/logout', {
      method: 'POST',
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  forgotPassword: (payload: { identifier: string }) =>
    requestJson<ForgotPasswordResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  validateResetToken: (payload: { token: string }) =>
    requestJson<ValidateResetTokenResponse>('/api/auth/reset-password/validate', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    requestJson<ResetPasswordResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
      skipRefreshRetry: true,
    }),

  verifySession: () =>
    requestJson<{ authenticated: boolean; principal: SessionPrincipal }>('/api/auth/me'),

  getDashboardSummary: () => requestJson<DashboardSummary>('/api/dashboard/summary'),

  listTasks: async (filters?: { status?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters?.search?.trim()) {
      params.set('search', filters.search.trim());
    }
    const qs = params.toString();
    const res = await requestJson<{ data: TaskRecord[] }>(`/api/tasks${qs ? `?${qs}` : ''}`);
    return res.data;
  },

  createTask: async (input: CreateTaskInput) => {
    const res = await requestJson<{ data: TaskRecord }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  updateTask: async (id: number, input: UpdateTaskInput) => {
    const res = await requestJson<{ data: TaskRecord }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  deleteTask: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  duplicateTask: async (id: number) => {
    const res = await requestJson<{ data: TaskRecord }>(`/api/tasks/${id}/duplicate`, {
      method: 'POST',
    });
    return res.data;
  },

  runTaskNow: (id: number) =>
    requestJson<{ outcome: RunTaskOutcome; task: TaskRecord | null }>(`/api/tasks/${id}/run`, {
      method: 'POST',
    }),

  seedSampleTasks: async () => {
    const res = await requestJson<{ data: TaskRecord[] }>('/api/tasks/seed-samples', {
      method: 'POST',
    });
    return res.data;
  },

  listLogs: async (filters?: {
    taskId?: number;
    status?: string;
    search?: string;
    limit?: number;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.taskId) params.set('taskId', String(filters.taskId));
    if (filters?.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters?.search?.trim()) params.set('search', filters.search.trim());
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.page) params.set('page', String(filters.page));
    const qs = params.toString();
    return requestJson<LogPage>(`/api/logs${qs ? `?${qs}` : ''}`);
  },

  listApiKeys: async () => {
    const res = await requestJson<{ data: ApiKeyRecord[] }>('/api/keys');
    return res.data;
  },

  createApiKey: (name: string) =>
    requestJson<{ data: ApiKeyRecord; rawKey: string }>('/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  revokeApiKey: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/keys/${id}`, {
      method: 'DELETE',
    }),
};
