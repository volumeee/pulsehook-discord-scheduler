import { motion, useReducedMotion } from 'motion/react';
import { LogOut, Plus, RefreshCw, Webhook } from 'lucide-react';
import type { SessionPrincipal } from '../../lib/api';
import { NAV_ITEMS, type ActiveTab } from './navItems';

interface WorkspaceHeaderProps {
  activeTab: ActiveTab;
  principal: SessionPrincipal;
  loadingSummary: boolean;
  loadingTasks: boolean;
  openCreateEditor: () => void;
  refreshWorkspace: (silent?: boolean) => Promise<void>;
  handleSignOut: () => Promise<void>;
}

export function WorkspaceHeader({
  activeTab,
  principal,
  loadingSummary,
  loadingTasks,
  openCreateEditor,
  refreshWorkspace,
  handleSignOut,
}: WorkspaceHeaderProps) {
  const prefersReduced = useReducedMotion();
  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];
  const accountLabel =
    principal.displayName ||
    (principal.username ? `@${principal.username}` : principal.keyName || 'PulseHook');
  const isRefreshing = loadingSummary || loadingTasks;

  return (
    <header className="sticky top-0 z-20 overflow-hidden border-b border-[#E6E8F0] bg-white/88 backdrop-blur-md lg:bg-white">
      {/* Mobile topbar infinite ambient motion layers (GPU transform/opacity only) */}
      {!prefersReduced && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 lg:hidden">
          <motion.div
            animate={{ x: ['-28%', '28%', '-28%'], opacity: [0.32, 0.68, 0.32] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-y-4 -left-1/4 w-[150%] will-change-transform"
            style={{
              background:
                'radial-gradient(42% 110% at 50% 50%, rgba(88,101,242,0.14) 0%, rgba(56,189,248,0.08) 48%, rgba(255,255,255,0) 78%)',
            }}
          />
          <motion.div
            animate={{ x: ['-65%', '165%'] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-0 left-0 h-[2px] w-2/5 rounded-full will-change-transform"
            style={{
              background:
                'linear-gradient(90deg, rgba(88,101,242,0) 0%, rgba(88,101,242,0.55) 50%, rgba(129,140,248,0) 100%)',
            }}
          />
        </div>
      )}

      <div className="relative z-10 mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Mobile Brand Mark with infinite halo & rotating Webhook icon */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D78FF] via-[#5865F2] to-[#434ED8] text-white shadow-sm shadow-[#5865F2]/25 lg:hidden">
            {!prefersReduced && (
              <motion.span
                aria-hidden="true"
                animate={{ scale: [1, 1.22, 1], opacity: [0.36, 0, 0.36] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute inset-0 rounded-xl bg-[#5865F2] will-change-transform"
              />
            )}
            <motion.span
              animate={prefersReduced ? undefined : { rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="relative z-10 inline-flex will-change-transform"
            >
              <Webhook className="h-4 w-4" />
            </motion.span>
          </div>

          <div className="min-w-0">
            <h1 className="font-display truncate text-base font-bold tracking-tight text-[#111827] sm:text-lg">
              {currentNav.label}
            </h1>
            <p className="hidden truncate text-xs text-[#525B70] lg:block">{currentNav.subtitle}</p>
            <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-[#525B70] lg:hidden">
              <motion.span
                aria-hidden="true"
                animate={
                  prefersReduced ? undefined : { scale: [1, 1.35, 1], opacity: [0.9, 0.35, 0.9] }
                }
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#10B981] will-change-transform"
              />
              <span className="truncate">{accountLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => void refreshWorkspace(false)}
            aria-label="Refresh workspace data"
            title="Refresh data"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E8F0] bg-white/90 text-[#525B70] transition-colors hover:bg-[#F6F7FB] hover:text-[#111827]"
          >
            <motion.span
              animate={
                !prefersReduced && !isRefreshing
                  ? { rotate: [0, 14, 0], scale: [1, 1.05, 1] }
                  : undefined
              }
              transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex will-change-transform"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.span>
          </motion.button>

          {/* Mobile Sign Out (desktop uses sidebar Sign out) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => void handleSignOut()}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E6E8F0] bg-white/90 px-2.5 text-xs font-semibold text-[#525B70] transition-colors hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#DC2626] sm:px-3 lg:hidden"
          >
            <motion.span
              animate={prefersReduced ? undefined : { x: [0, 1.5, 0] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex will-change-transform"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
            </motion.span>
            <span className="hidden min-[360px]:inline">Sign out</span>
          </motion.button>

          {/* Desktop-only New Task (mobile uses the curved bottom navbar circular FAB) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={openCreateEditor}
            className="hidden min-h-[38px] items-center gap-1.5 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#4752C4] lg:inline-flex"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>New Task</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
