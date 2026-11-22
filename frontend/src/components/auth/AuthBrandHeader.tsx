'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Webhook } from 'lucide-react';
import { SPRING_SNAPPY } from '../shared/motion';

export function AuthBrandHeader({ description }: { description: string }) {
  const prefersReduced = useReducedMotion();

  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <motion.div
        whileHover={{ scale: 1.04 }}
        transition={SPRING_SNAPPY}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5865F2] text-white shadow-md shadow-[#5865F2]/25"
      >
        <motion.span
          animate={prefersReduced ? undefined : { rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="inline-flex will-change-transform"
        >
          <Webhook className="h-6 w-6" />
        </motion.span>
      </motion.div>
      <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-[#111827]">
        PulseHook
      </h1>
      <p className="mt-1 text-sm text-[#525B70]">{description}</p>
    </div>
  );
}
