import { create } from "zustand";

const MAX_SAMPLES = 36;

export type RunningSample = { t: string; running: number; at: number };

type MetricsState = {
  runningHistory: RunningSample[];
  k8sRunningHistory: RunningSample[];
  pushRunning: (running: number) => void;
  pushK8sRunning: (running: number) => void;
};

function label(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function pushSample(history: RunningSample[], running: number): RunningSample[] {
  const at = Date.now();
  const next = [...history, { t: label(at), running, at }];
  return next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;
}

/** Ring buffer of real dashboard poll samples (not synthetic). */
export const useMetricsStore = create<MetricsState>((set) => ({
  runningHistory: [],
  k8sRunningHistory: [],
  pushRunning: (running) => set((s) => ({ runningHistory: pushSample(s.runningHistory, running) })),
  pushK8sRunning: (running) =>
    set((s) => ({ k8sRunningHistory: pushSample(s.k8sRunningHistory, running) })),
}));
