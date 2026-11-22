'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  ariaLabel,
  className = '',
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={handleCopy}
      aria-label={ariaLabel || label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E6E8F0] bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#111827] transition-colors hover:border-[#C7CCDB] hover:bg-[#F6F7FB] focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:outline-none ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.14 }}
            className="inline-flex items-center gap-1.5 text-[#15803D]"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{copiedLabel}</span>
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.14 }}
            className="inline-flex items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5 text-[#525B70]" />
            <span>{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
