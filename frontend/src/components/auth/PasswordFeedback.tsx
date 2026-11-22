'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import type { PasswordEvaluation } from '../../utils/passwordStrength';
import { EASE_SETTLE } from '../shared/motion';

export function passwordStrengthTextColor(score: PasswordEvaluation['score']): string {
  return score <= 1
    ? 'text-[#DC2626]'
    : score === 2
      ? 'text-[#B45309]'
      : score === 3
        ? 'text-[#5865F2]'
        : 'text-[#15803D]';
}

export function PasswordFeedback({ evaluation }: { evaluation: PasswordEvaluation }) {
  const strengthColor =
    evaluation.score <= 1
      ? 'bg-[#DC2626]'
      : evaluation.score === 2
        ? 'bg-[#D97706]'
        : evaluation.score === 3
          ? 'bg-[#5865F2]'
          : 'bg-[#15803D]';

  return (
    <>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => {
          const active = evaluation.score >= step;
          return (
            <div key={step} className="h-1.5 overflow-hidden rounded-full bg-[#EEF0F6]">
              <motion.div
                initial={false}
                animate={{ scaleX: active ? 1 : 0 }}
                transition={{ duration: 0.22, ease: EASE_SETTLE }}
                style={{ transformOrigin: 'left' }}
                className={`h-full w-full ${strengthColor}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {[
          { ok: evaluation.hasMinLength, label: '8+ chars' },
          { ok: evaluation.hasMixedCase, label: 'Upper & lower' },
          { ok: evaluation.hasDigit, label: 'Number' },
        ].map((rule) => (
          <span
            key={rule.label}
            className={`inline-flex items-center gap-1 transition-colors ${
              rule.ok ? 'font-medium text-[#15803D]' : 'text-[#64748B]'
            }`}
          >
            <Check className={`h-3 w-3 ${rule.ok ? 'opacity-100' : 'opacity-35'}`} />
            <span>{rule.label}</span>
          </span>
        ))}
      </div>
    </>
  );
}
