import { motion, useReducedMotion } from 'motion/react';
import { LogOut, Webhook } from 'lucide-react';
import type { SessionPrincipal } from '../../lib/api';
import { SPRING_SNAPPY } from '../shared/motion';
import { NAV_ITEMS, type NavigationProps } from './navItems';

interface WorkspaceSidebarProps extends NavigationProps {
  principal: SessionPrincipal;
  tasksCount: number;
  logsCount: number;
  handleSignOut: () => Promise<void>;
}

export function WorkspaceSidebar({
  activeTab,
  setActiveTab,
  principal,
  tasksCount,
  logsCount,
  handleSignOut,
}: WorkspaceSidebarProps) {
  const prefersReduced = useReducedMotion();

  return (
    <aside
      aria-label="Workspace navigation"
      className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-[#E6E8F0] bg-white lg:flex"
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-[#E6E8F0] px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5865F2] text-white shadow-sm shadow-[#5865F2]/25">
          <motion.span
            animate={prefersReduced ? undefined : { rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="inline-flex will-change-transform"
          >
            <Webhook className="h-4 w-4" />
          </motion.span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-bold tracking-tight text-[#111827]">
            PulseHook
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          const countBadge =
            item.id === 'tasks' ? tasksCount : item.id === 'logs' ? logsCount : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'text-[#5865F2]' : 'text-[#525B70] hover:bg-[#F6F7FB] hover:text-[#111827]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="desktopNavActive"
                  transition={SPRING_SNAPPY}
                  className="absolute inset-0 rounded-xl bg-[#EEF0FF]"
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5">
                <motion.span
                  animate={
                    active && !prefersReduced
                      ? { y: [0, -1.5, 0], scale: [1, 1.07, 1] }
                      : { y: 0, scale: 1 }
                  }
                  transition={
                    active && !prefersReduced
                      ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.2 }
                  }
                  className="inline-flex will-change-transform"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </motion.span>
                <span>{item.label}</span>
              </span>
              {countBadge !== null && (
                <span className="relative z-10 font-mono text-xs text-[#525B70] tabular-nums">
                  {countBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#E6E8F0] p-4">
        <div className="rounded-xl bg-[#F6F7FB] p-3">
          <div className="flex items-center gap-2.5">
            <div className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865F2] text-xs font-bold text-white uppercase">
              {(principal.username || principal.keyName || 'P').slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#111827]">
                {principal.displayName ||
                  (principal.username ? `@${principal.username}` : principal.keyName)}
              </p>
              <p className="truncate text-[11px] text-[#525B70]">
                {principal.email || 'OTP-verified session'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E6E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#525B70] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
