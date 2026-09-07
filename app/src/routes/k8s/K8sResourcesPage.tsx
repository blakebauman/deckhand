import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { StatusBadge } from "@/components/StatusBadge";
import { useUIStore } from "@/stores/uiStore";
import { K8sChrome } from "@/routes/k8s/K8sChrome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type ResourceTab =
  | "services"
  | "ingresses"
  | "configmaps"
  | "secrets"
  | "nodes"
  | "events"
  | "jobs"
  | "cronjobs"
  | "statefulsets";

const tabs: { id: ResourceTab; label: string }[] = [
  { id: "services", label: "Services" },
  { id: "ingresses", label: "Ingresses" },
  { id: "configmaps", label: "ConfigMaps" },
  { id: "secrets", label: "Secrets" },
  { id: "nodes", label: "Nodes" },
  { id: "events", label: "Events" },
  { id: "jobs", label: "Jobs" },
  { id: "cronjobs", label: "CronJobs" },
  { id: "statefulsets", label: "StatefulSets" },
];

function nameOf(item: any): string {
  return item?.metadata?.name || item?.name || "—";
}

function ResourceList({
  title,
  loading,
  items,
  q,
  onQ,
  renderMeta,
}: {
  title: string;
  loading: boolean;
  items: any[];
  q: string;
  onQ: (v: string) => void;
  renderMeta: (item: any) => ReactNode;
}) {
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => nameOf(it).toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <ListPane
      title={title}
      loading={loading}
      empty={
        <ListEmpty
          title={q ? "No matches" : `No ${title.toLowerCase()}`}
          description={q ? "Try another name." : "Nothing in this namespace (or cluster) yet."}
        />
      }
      search={{ value: q, onChange: onQ, placeholder: `Search ${title.toLowerCase()}` }}
    >
      {filtered.map((item, i) => (
        <ListItem key={item?.metadata?.uid || `${nameOf(item)}-${i}`} active={false}>
          <div className="min-w-0 truncate text-sm font-medium">{nameOf(item)}</div>
          <div className="mt-0.5 min-w-0">{renderMeta(item)}</div>
        </ListItem>
      ))}
    </ListPane>
  );
}

export function K8sResourcesPage() {
  const namespace = useUIStore((s) => s.namespace);
  const [tab, setTab] = useState<ResourceTab>("services");
  const [q, setQ] = useState("");

  const services = useQuery({
    queryKey: ["k8s-services", namespace],
    queryFn: () => api.k8sServices(namespace),
    enabled: tab === "services",
    refetchInterval: 8000,
  });
  const ingresses = useQuery({
    queryKey: ["k8s-ingresses", namespace],
    queryFn: () => api.k8sIngresses(namespace),
    enabled: tab === "ingresses",
    refetchInterval: 8000,
  });
  const configmaps = useQuery({
    queryKey: ["k8s-configmaps", namespace],
    queryFn: () => api.k8sConfigMaps(namespace),
    enabled: tab === "configmaps",
    refetchInterval: 10000,
  });
  const secrets = useQuery({
    queryKey: ["k8s-secrets", namespace],
    queryFn: () => api.k8sSecrets(namespace),
    enabled: tab === "secrets",
    refetchInterval: 10000,
  });
  const nodes = useQuery({
    queryKey: ["k8s-nodes"],
    queryFn: () => api.k8sNodes(),
    enabled: tab === "nodes",
    refetchInterval: 10000,
  });
  const events = useQuery({
    queryKey: ["k8s-events", namespace],
    queryFn: () => api.k8sEvents(namespace),
    enabled: tab === "events",
    refetchInterval: 5000,
  });
  const jobs = useQuery({
    queryKey: ["k8s-jobs", namespace],
    queryFn: () => api.k8sJobs(namespace),
    enabled: tab === "jobs",
    refetchInterval: 8000,
  });
  const cronjobs = useQuery({
    queryKey: ["k8s-cronjobs", namespace],
    queryFn: () => api.k8sCronJobs(namespace),
    enabled: tab === "cronjobs",
    refetchInterval: 10000,
  });
  const statefulsets = useQuery({
    queryKey: ["k8s-statefulsets", namespace],
    queryFn: () => api.k8sStatefulSets(namespace),
    enabled: tab === "statefulsets",
    refetchInterval: 8000,
  });

  return (
    <K8sChrome>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Tabs
          aria-label="Kubernetes resources"
          value={tab}
          onValueChange={(k) => {
            setTab(String(k) as ResourceTab);
            setQ("");
          }}
          className="flex h-full min-h-0 flex-col gap-3"
        >
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="services" className="mt-3 h-full min-h-0">
            <ResourceList
              title="Services"
              loading={services.isLoading}
              items={services.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(s) => (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {s.spec?.type || "ClusterIP"}
                  {" · "}
                  {s.spec?.clusterIP || "—"}
                  {(s.spec?.ports || [])
                    .slice(0, 3)
                    .map((p: any) => ` · ${p.port}${p.protocol ? "/" + p.protocol : ""}`)
                    .join("")}
                </span>
              )}
            />
          </TabsContent>

          <TabsContent value="ingresses" className="mt-3 h-full min-h-0">
            <ResourceList
              title="Ingresses"
              loading={ingresses.isLoading}
              items={ingresses.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(ing) => {
                const hosts = (ing.spec?.rules || []).map((r: any) => r.host).filter(Boolean);
                return (
                  <span className="text-xs text-muted-foreground truncate">
                    {hosts.length ? hosts.join(", ") : "no hosts"}
                  </span>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="configmaps" className="mt-3 h-full min-h-0">
            <ResourceList
              title="ConfigMaps"
              loading={configmaps.isLoading}
              items={configmaps.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(cm) => {
                const keys = Object.keys(cm.data || {});
                return (
                  <span className="text-xs text-muted-foreground truncate">
                    {keys.length} key{keys.length === 1 ? "" : "s"}
                    {keys.length ? `: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}` : ""}
                  </span>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="secrets" className="mt-3 h-full min-h-0">
            <ResourceList
              title="Secrets"
              loading={secrets.isLoading}
              items={secrets.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(sec) => {
                const keys = Object.keys(sec.data || sec.stringData || {});
                return (
                  <span className="text-xs text-muted-foreground truncate">
                    {sec.type || "Opaque"}
                    {" · "}
                    {keys.length
                      ? `keys: ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? "…" : ""}`
                      : "no keys"}
                  </span>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="nodes" className="mt-3 h-full min-h-0">
            <ResourceList
              title="Nodes"
              loading={nodes.isLoading}
              items={nodes.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(n) => {
                const ready = (n.status?.conditions || []).find((c: any) => c.type === "Ready");
                const ok = ready?.status === "True";
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={ok ? "success" : "destructive"}>{ok ? "Ready" : "NotReady"}</StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {n.status?.nodeInfo?.kubeletVersion || ""}
                    </span>
                  </div>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="events" className="mt-3 h-full min-h-0">
            <ResourceList
              title="Events"
              loading={events.isLoading}
              items={events.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(ev) => (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {ev.reason || ev.type || "Event"}
                    {" · "}
                    {ev.involvedObject?.kind}/{ev.involvedObject?.name || ev.involved || ""}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {ev.message || "—"}
                  </span>
                </div>
              )}
            />
          </TabsContent>

          <TabsContent value="jobs" className="mt-3 h-full min-h-0">
            <ResourceList
              title="Jobs"
              loading={jobs.isLoading}
              items={jobs.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(j) => (
                <span className="text-xs text-muted-foreground">
                  completions {j.status?.succeeded ?? 0}/{j.spec?.completions ?? 1}
                  {j.status?.failed ? ` · failed ${j.status.failed}` : ""}
                </span>
              )}
            />
          </TabsContent>

          <TabsContent value="cronjobs" className="mt-3 h-full min-h-0">
            <ResourceList
              title="CronJobs"
              loading={cronjobs.isLoading}
              items={cronjobs.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(cj) => (
                <span className="text-xs text-muted-foreground">
                  {cj.spec?.schedule || "—"}
                  {" · "}
                  {cj.spec?.suspend ? "suspended" : "active"}
                </span>
              )}
            />
          </TabsContent>

          <TabsContent value="statefulsets" className="mt-3 h-full min-h-0">
            <ResourceList
              title="StatefulSets"
              loading={statefulsets.isLoading}
              items={statefulsets.data || []}
              q={q}
              onQ={setQ}
              renderMeta={(ss) => (
                <span className="text-xs text-muted-foreground">
                  {ss.status?.readyReplicas ?? 0}/{ss.spec?.replicas ?? 0} ready
                </span>
              )}
            />
          </TabsContent>
        </Tabs>
      </div>
    </K8sChrome>
  );
}
