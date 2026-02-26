'use client';
import { useState, useEffect, useRef } from 'react';
interface AnimCounterProps { value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number; delay?: number; }
export default function AnimCounter({ value, prefix = '', suffix = '', decimals = 0, duration = 1200, delay = 200 }: AnimCounterProps) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    started.current = false;
    const timeout = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplay(eased * value);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, duration, delay]);
  return <span>{prefix}{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}{suffix}</span>;
}
