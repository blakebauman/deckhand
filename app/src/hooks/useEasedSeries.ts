import { useEffect, useMemo, useRef, useState } from "react";

/** Ease-out cubic — finishes before the next ~1s Docker sample. */
function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/**
 * Live series easing: committed history stays at true values (spikes stay visible);
 * only the newest tip lerps toward the latest sample.
 */
export function useEasedSeries(target: number[], durationMs = 280): number[] {
  const [tip, setTip] = useState(() => target[target.length - 1] ?? 0);
  const tipRef = useRef(tip);
  const fromRef = useRef(tip);
  const toRef = useRef(tip);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const lastLenRef = useRef(target.length);
  const lastTargetRef = useRef(target);

  useEffect(() => {
    const nextTip = target[target.length - 1] ?? 0;
    const prev = lastTargetRef.current;
    const prevTip = prev[prev.length - 1] ?? tipRef.current;

    // New sample (length change or tip value change) — ease tip only.
    const sampleChanged =
      target !== lastTargetRef.current &&
      (target.length !== lastLenRef.current || nextTip !== prevTip);

    lastTargetRef.current = target;
    lastLenRef.current = target.length;

    if (!sampleChanged && target.length > 0) {
      return;
    }

    fromRef.current = tipRef.current;
    toRef.current = nextTip;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);

    if (target.length === 0) {
      tipRef.current = 0;
      setTip(0);
      return;
    }

    // First point: snap.
    if (prev.length === 0) {
      tipRef.current = nextTip;
      setTip(nextTip);
      return;
    }

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const e = easeOutCubic(t);
      const next = fromRef.current + (toRef.current - fromRef.current) * e;
      tipRef.current = next;
      setTip(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return useMemo(() => {
    if (target.length === 0) return [];
    if (target.length === 1) return [tip];
    // History is exact; only the live edge is eased.
    return [...target.slice(0, -1), tip];
  }, [target, tip]);
}

/** Same short ease for headline metric numbers (keep in sync with sparkline tip). */
export function useEasedNumber(target: number, durationMs = 280): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const fromRef = useRef(target);
  const toRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    fromRef.current = displayRef.current;
    toRef.current = target;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const e = easeOutCubic(t);
      const next = fromRef.current + (toRef.current - fromRef.current) * e;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return display;
}
