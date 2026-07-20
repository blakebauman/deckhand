import { create } from "zustand";

const MAX_SAMPLES = 36;

export type RunningSample = {
  /** Stable ordinal for chart X (avoids locale time-string sort bugs). */
  i: number;
  /** Display label for tooltips. */
  t: string;
  running: number;
  at: number;
};

type MetricsState = {
  runningHistory: RunningSample[];
  k8sRunningHistory: RunningSample[];
  pushRunning: (running: number) => void;
  pushK8sRunning: (running: number) => void;
  clearRunning: () => void;
};

function label(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function pushSample(history: RunningSample[], running: number): RunningSample[] {
  const at = Date.now();
  const value = Math.max(0, Math.round(running));
  const last = history[history.length - 1];
  // Collapse back-to-back identical polls so the step chart doesn’t stair on noise.
  if (last && last.running === value && at - last.at < 2_000) {
    return history;
  }
  const next: RunningSample = {
    i: last ? last.i + 1 : 0,
    t: label(at),
    running: value,
    at,
  };
  const out = [...history, next];
  return out.length > MAX_SAMPLES ? out.slice(-MAX_SAMPLES) : out;
}

/** Ring buffer of real dashboard poll samples (not synthetic). */
export const useMetricsStore = create<MetricsState>((set) => ({
  runningHistory: [],
  k8sRunningHistory: [],
  pushRunning: (running) => set((s) => ({ runningHistory: pushSample(s.runningHistory, running) })),
  pushK8sRunning: (running) =>
    set((s) => ({ k8sRunningHistory: pushSample(s.k8sRunningHistory, running) })),
  clearRunning: () => set({ runningHistory: [] }),
}));
