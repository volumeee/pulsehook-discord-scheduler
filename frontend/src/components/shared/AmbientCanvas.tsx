'use client';

import { motion, useReducedMotion } from 'motion/react';

export function AmbientCanvas({ variant = 'auth' }: { variant?: 'auth' | 'workspace' }) {
  const prefersReduced = useReducedMotion();

  if (variant === 'workspace') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Seamlessly drifting dot matrix (28px tile translated by 28px linearly) */}
        <motion.div
          animate={prefersReduced ? undefined : { x: [0, 28], y: [0, 28] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          className="absolute -inset-[28px] opacity-[0.42] will-change-transform"
          style={{
            backgroundImage: 'radial-gradient(#94A3B8 0.95px, transparent 0.95px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Primary Indigo aurora orb */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  x: [0, -52, 24, 0],
                  y: [0, 38, -20, 0],
                  scale: [1, 1.14, 0.94, 1],
                }
          }
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-36 right-[-18%] h-[480px] w-[480px] rounded-full opacity-[0.75] will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(88,101,242,0.24) 0%, rgba(129,140,248,0.11) 42%, rgba(246,247,251,0) 70%)',
          }}
        />

        {/* Secondary Sky / Periwinkle counter-drifting orb */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  x: [0, 56, -24, 0],
                  y: [0, -44, 22, 0],
                  scale: [1, 0.92, 1.15, 1],
                }
          }
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -bottom-36 left-[-18%] h-[460px] w-[460px] rounded-full opacity-[0.72] will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(88,101,242,0.09) 45%, rgba(246,247,251,0) 72%)',
          }}
        />

        {/* Mid-viewport Violet breathing wash */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  x: [0, -34, 34, 0],
                  y: [0, -28, 28, 0],
                  scale: [0.94, 1.1, 0.94],
                  opacity: [0.4, 0.65, 0.4],
                }
          }
          transition={{
            duration: 21,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-[36%] left-[20%] h-[380px] w-[380px] rounded-full will-change-transform"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(88,101,242,0.06) 46%, rgba(246,247,251,0) 70%)',
          }}
        />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Seamlessly drifting architectural dot grid */}
      <motion.div
        animate={prefersReduced ? undefined : { x: [0, 26], y: [0, 26] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        className="absolute -inset-[26px] opacity-[0.48] will-change-transform"
        style={{
          backgroundImage: 'radial-gradient(#94A3B8 0.95px, transparent 0.95px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 42%, black 35%, transparent 100%)',
        }}
      />

      {/* Primary Indigo breathing wash */}
      <motion.div
        animate={
          prefersReduced
            ? undefined
            : {
                x: [0, 38, -24, 0],
                y: [0, -28, 22, 0],
                scale: [1, 1.1, 0.95, 1],
              }
        }
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-44 -left-32 h-[580px] w-[580px] rounded-full opacity-[0.72] will-change-transform"
        style={{
          background:
            'radial-gradient(circle, rgba(88,101,242,0.24) 0%, rgba(129,140,248,0.10) 42%, rgba(246,247,251,0) 70%)',
        }}
      />

      {/* Secondary soft Sky/Periwinkle wash */}
      <motion.div
        animate={
          prefersReduced
            ? undefined
            : {
                x: [0, -36, 26, 0],
                y: [0, 28, -20, 0],
                scale: [1, 0.94, 1.1, 1],
              }
        }
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -right-32 -bottom-44 h-[600px] w-[600px] rounded-full opacity-[0.68] will-change-transform"
        style={{
          background:
            'radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(88,101,242,0.09) 44%, rgba(246,247,251,0) 70%)',
        }}
      />
    </div>
  );
}
