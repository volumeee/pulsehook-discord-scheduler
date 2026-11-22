import { KeyRound, LayoutDashboard, ListChecks, ScrollText } from 'lucide-react';

export type ActiveTab = 'overview' | 'tasks' | 'logs' | 'api';

export const NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
  subtitle: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    mobileLabel: 'Overview',
    icon: LayoutDashboard,
    subtitle: 'Health metrics, upcoming webhook schedules, and live delivery feed',
  },
  {
    id: 'tasks',
    label: 'Scheduled Tasks',
    mobileLabel: 'Tasks',
    icon: ListChecks,
    subtitle: 'Manage recurring Discord webhooks, cron schedules, and retry policies',
  },
  {
    id: 'logs',
    label: 'Delivery Logs',
    mobileLabel: 'Logs',
    icon: ScrollText,
    subtitle: 'Inspect HTTP status codes, retry attempts, and response diagnostics',
  },
  {
    id: 'api',
    label: 'API Access',
    mobileLabel: 'API Keys',
    icon: KeyRound,
    subtitle: 'Account security, SHA-256 X-API-Key tokens, and ready-to-run curl snippets',
  },
];

export interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}
