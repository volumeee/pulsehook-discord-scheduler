'use client';

import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({
  value,
  suffix = '',
  className = '',
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    const from = previousRef.current;
    const to = value;
    previousRef.current = to;
    if (from === to) {
      setDisplayed(to);
      return;
    }

    const durationMs = 260;
    const started = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <span className={`tabular-nums ${className}`}>
      {displayed}
      {suffix}
    </span>
  );
}
