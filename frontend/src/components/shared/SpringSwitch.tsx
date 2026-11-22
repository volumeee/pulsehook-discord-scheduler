'use client';

import { motion } from 'motion/react';
import { SPRING_SNAPPY } from './motion';

export function SpringSwitch({
  checked,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-[#5865F2] bg-[#5865F2]' : 'border-[#D5D9E4] bg-[#E6E8F0]'
      }`}
    >
      <motion.span
        layout
        transition={SPRING_SNAPPY}
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ${
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
