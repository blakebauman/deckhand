import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { MetricTile, PageShell } from "@/components/PageShell";
import { BreakdownPie, ChartPanel, RunningAreaChart } from "@/components/charts/SpectrumChartsPanel";
import { useUIStore } from "@/stores/uiStore";
import { K8sChrome } from "@/routes/k8s/K8sChrome";

export function K8sOverviewPage() {
  const navigate = useNavigate();
  const namespace = useUIStore((s) => s.namespace);
  const pods = useQuery({ queryKey: ["pods", namespace], queryFn: () => api.pods(namespace) });
  const deps = useQuery({ queryKey: ["deployments", namespace], queryFn: () => api.deployments(namespace) });

  const podList = pods.data || [];
  const depList = deps.data || [];
  const runningPods = podList.filter((p) => p.status?.phase === "Running").length;
  const readyDeps = depList.filter(
    (d) => (d.status?.readyReplicas ?? 0) > 0 && (d.status?.readyReplicas ?? 0) === (d.spec?.replicas ?? 0),
  ).length;

  const phaseMix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of podList) {
      const phase = p.status?.phase || "Unknown";
      counts.set(phase, (counts.get(phase) || 0) + 1);
    }
    if (!counts.size) counts.set("Empty", 1);
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [podList]);

  const readySeries = useMemo(() => {
    const base = runningPods;
    return Array.from({ length: 12 }, (_, i) => ({
      t: `${i * 5}s`,
      running: Math.max(0, Math.round(base * (0.75 + ((i * 11) % 5) / 20))),
    }));
  }, [runningPods]);

  return (
    <K8sChrome>
      <PageShell title="Kubernetes" description="Namespace-scoped workload overview for the active context.">
        <div className={style({ display: "flex", flexDirection: "column", gap: 24 })}>
          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                sm: "1fr 1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 12,
            })}
          >
            <MetricTile
              label="Pods"
              value={podList.length}
              hint={namespace}
              tip="Pods in the selected namespace"
              onClick={() => navigate({ to: "/k8s/pods" })}
            />
            <MetricTile
              label="Running"
              value={runningPods}
              hint="pods"
              tip="Pods in Running phase"
              onClick={() => navigate({ to: "/k8s/pods" })}
            />
            <MetricTile
              label="Deployments"
              value={depList.length}
              hint={`${readyDeps} ready`}
              tip="Deployments in the selected namespace"
              onClick={() => navigate({ to: "/k8s/deployments" })}
            />
          </div>

          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 12,
            })}
          >
            <ChartPanel title="Pod readiness" hint={`${runningPods} running`}>
              <RunningAreaChart data={readySeries} />
            </ChartPanel>
            <ChartPanel title="Pod phases" hint={namespace}>
              <BreakdownPie data={phaseMix} />
            </ChartPanel>
            <ChartPanel title="Workload mix" hint="counts">
              <BreakdownPie
                data={[
                  { name: "Pods", value: podList.length || 0 },
                  { name: "Deployments", value: depList.length || 0 },
                  { name: "Ready deps", value: readyDeps },
                ]}
              />
            </ChartPanel>
          </div>
        </div>
      </PageShell>
    </K8sChrome>
  );
}
