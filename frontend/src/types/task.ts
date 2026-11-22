export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: DiscordEmbedFooter;
  fields?: DiscordEmbedField[];
}

export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: DiscordEmbed[];
}

export type TaskStatus = 'active' | 'paused' | 'failed';
export type ExecutionLogStatus = 'success' | 'failed' | 'retrying';

export interface TaskRecord {
  id: number;
  userUid?: string | null;
  name: string;
  schedule: string;
  webhookUrl: string;
  payload: DiscordWebhookPayload;
  maxRetry: number;
  retryDelayMs: number;
  status: TaskStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLogRecord {
  id: number;
  taskId: number;
  taskName?: string;
  executionTime: string;
  status: ExecutionLogStatus;
  retryCount: number;
  httpStatus: number | null;
  durationMs: number;
  message: string;
  createdAt: string;
}

export interface LogMetrics {
  total: number;
  success: number;
  failed: number;
  retrying: number;
  avgDurationMs: number;
}

export interface LogPage {
  data: TaskLogRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    metrics: LogMetrics;
  };
}

export interface ApiKeyRecord {
  id: number;
  userUid?: string | null;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalTasks: number;
  activeTasks: number;
  pausedTasks: number;
  failedTasks: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDurationMs: number;
  upcomingTasks: TaskRecord[];
  recentLogs: TaskLogRecord[];
}

export interface CreateTaskInput {
  name: string;
  schedule: string;
  webhookUrl: string;
  payload: DiscordWebhookPayload;
  maxRetry: number;
  retryDelayMs?: number;
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  name?: string;
  schedule?: string;
  webhookUrl?: string;
  payload?: DiscordWebhookPayload;
  maxRetry?: number;
  retryDelayMs?: number;
  status?: TaskStatus;
}

export interface RunTaskOutcome {
  taskId: number;
  succeeded: boolean;
  attempts: number;
  finalStatus: 'success' | 'failed' | 'retrying';
  httpStatus: number | null;
  durationMs: number;
  message: string;
  skippedDueToLock?: boolean;
}
