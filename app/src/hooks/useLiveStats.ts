import { useCallback, useEffect, useState } from "react";

const HISTORY = 60;

export type LiveHist = { cpu: number[]; mem: number[]; net: number[] };

export type LiveLabel = {
  cpu: number;
  mem: number;
  memUsage: number;
  memLimit: number;
  netRx: number;
  netTx: number;
  /** Bytes transferred since previous sample (≈ throughput for ~1s interval). */
  netRate: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
};

type SampleIn = {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
  pids: number;
  netDelta: number;
  skipCpu?: boolean;
};

/**
 * Live Docker stats — update React only when a sample arrives (~1 Hz).
 * No spring / rAF loop: that felt like slow-mo and thrashed Vega.
 */
export function useLiveStats(running: boolean) {
  const [sampleLabel, setSampleLabel] = useState<LiveLabel | null>(null);
  const [hist, setHist] = useState<LiveHist>({ cpu: [], mem: [], net: [] });

  useEffect(() => {
    if (!running) {
      setSampleLabel(null);
      setHist({ cpu: [], mem: [], net: [] });
    }
  }, [running]);

  const pushSample = useCallback((next: SampleIn) => {
    setSampleLabel({
      cpu: Math.max(0, next.cpuPercent),
      mem: Math.max(0, Math.min(100, next.memoryPercent)),
      memUsage: next.memoryUsage,
      memLimit: next.memoryLimit,
      netRx: next.netRx,
      netTx: next.netTx,
      netRate: Math.max(0, next.netDelta),
      blockRead: next.blockRead,
      blockWrite: next.blockWrite,
      pids: next.pids,
    });
    setHist((h) => ({
      cpu: next.skipCpu ? h.cpu : [...h.cpu, Math.max(0, next.cpuPercent)].slice(-HISTORY),
      mem: [...h.mem, Math.max(0, Math.min(100, next.memoryPercent))].slice(-HISTORY),
      net: [...h.net, Math.max(0, next.netDelta)].slice(-HISTORY),
    }));
  }, []);

  return { sampleLabel, hist, pushSample };
}
