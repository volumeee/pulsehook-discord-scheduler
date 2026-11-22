import { motion, useReducedMotion } from 'motion/react';
import { Plus } from 'lucide-react';
import { SPRING_SNAPPY } from '../shared/motion';
import { NAV_ITEMS, type NavigationProps } from './navItems';

interface MobileNavigationProps extends NavigationProps {
  openCreateEditor: () => void;
}

export function MobileNavigation({
  activeTab,
  setActiveTab,
  openCreateEditor,
}: MobileNavigationProps) {
  const prefersReduced = useReducedMotion();
  const leftItems = NAV_ITEMS.slice(0, 2);
  const rightItems = NAV_ITEMS.slice(2);

  const renderTabButton = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveTab(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
          active ? 'text-[#5865F2]' : 'text-[#525B70]'
        }`}
      >
        <motion.span
          animate={
            active && !prefersReduced
              ? { y: [0, -2.5, 0], scale: [1, 1.09, 1] }
              : { y: 0, scale: 1 }
          }
          transition={
            active && !prefersReduced
              ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
          className="inline-flex will-change-transform"
        >
          <Icon className="h-[18px] w-[18px]" />
        </motion.span>
        <span>{item.mobileLabel}</span>
        {active && (
          <motion.span
            layoutId="mobileNavIndicator"
            transition={SPRING_SNAPPY}
            className="absolute bottom-1.5 h-1 w-5 rounded-full bg-[#5865F2]"
          />
        )}
      </button>
    );
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="pointer-events-none fixed right-0 bottom-0 left-0 z-30 lg:hidden"
    >
      <div className="relative mx-auto w-full">
        {/* Center circular New Task FAB nestled into the curved cradle */}
        <div className="pointer-events-auto absolute -top-6 left-1/2 z-20 -translate-x-1/2">
          {!prefersReduced && (
            <motion.span
              aria-hidden="true"
              animate={{ scale: [1, 1.28, 1], opacity: [0.42, 0, 0.42] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-0 rounded-full bg-[#5865F2] will-change-transform"
            />
          )}
          <motion.button
            type="button"
            onClick={openCreateEditor}
            aria-label="New Task"
            title="New Task"
            whileTap={{ scale: 0.92 }}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6D78FF] via-[#5865F2] to-[#434ED8] text-white shadow-[0_10px_24px_-4px_rgba(88,101,242,0.58)] ring-1 ring-white/25 transition-all hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <motion.span
              animate={prefersReduced ? undefined : { rotate: [0, 90], scale: [1, 1.1, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex will-change-transform"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </motion.span>
          </motion.button>
        </div>

        {/* Curved bottom bar: flexible rounded wings + distortion-free 128px center cradle SVG */}
        <div className="pointer-events-auto relative flex h-16 w-full items-stretch drop-shadow-[0_-6px_18px_rgba(15,23,42,0.07)]">
          <div className="-mr-px flex-1 rounded-tl-[22px] border-t border-[#E6E8F0] bg-white" />
          <svg
            width="128"
            height="64"
            viewBox="0 0 128 64"
            aria-hidden="true"
            className="h-16 w-[128px] shrink-0 overflow-visible"
          >
            <path
              d="M 0 0.5 L 6 0.5 C 27 0.5, 30 39, 64 39 C 98 39, 101 0.5, 122 0.5 L 128 0.5 L 128 64 L 0 64 Z"
              fill="#FFFFFF"
            />
            <path
              d="M 0 0.5 L 6 0.5 C 27 0.5, 30 39, 64 39 C 98 39, 101 0.5, 122 0.5 L 128 0.5"
              fill="none"
              stroke="#E6E8F0"
              strokeWidth="1"
            />
          </svg>
          <div className="-ml-px flex-1 rounded-tr-[22px] border-t border-[#E6E8F0] bg-white" />

          {/* Interactive tabs split cleanly around the curved center notch */}
          <div className="absolute inset-0 flex items-center px-1.5">
            <div className="grid h-full flex-1 grid-cols-2">{leftItems.map(renderTabButton)}</div>
            <div className="w-[88px] shrink-0" aria-hidden="true" />
            <div className="grid h-full flex-1 grid-cols-2">{rightItems.map(renderTabButton)}</div>
          </div>
        </div>

        {/* Safe-area bottom extension */}
        <div className="pb-safe pointer-events-auto -mt-px bg-white" />
      </div>
    </nav>
  );
}
