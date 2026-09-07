import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConsolePanel } from "@/components/ConsolePanel";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { ExecTerminalLazy } from "@/components/ExecTerminalLazy";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { useUIStore } from "@/stores/uiStore";
import { copyText } from "@/routes/shared";
import { K8sChrome } from "@/routes/k8s/K8sChrome";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";


function phaseTone(phase?: string): "success" | "muted" | "destructive" {
  if (phase === "Running") return "success";
  if (phase === "Failed") return "destructive";
  return "muted";
}

export function PodsPage() {
  const namespace = useUIStore((s) => s.namespace);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [podTab, setPodTab] = useState<"logs" | "exec" | "inspect">("logs");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [q, setQ] = useState("");
  const list = useQuery({ queryKey: ["pods", namespace], queryFn: () => api.pods(namespace), refetchInterval: 5000 });

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((p) => p.metadata.name?.toLowerCase().includes(needle));
  }, [list.data, q]);

  const selectedPod = filtered.find((p) => p.metadata.name === selected);
  const phase = selectedPod?.status?.phase || "Unknown";

  return (
    <K8sChrome>
      <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
        <ListPane
          title="Pods"
          loading={list.isLoading}
          empty={
            <ListEmpty
              title={q ? "No matches" : "No pods"}
              description={q ? "Try another name." : `Nothing running in “${namespace}” yet.`}
            />
          }
          search={{ value: q, onChange: setQ, placeholder: "Search pods" }}
        >
          {filtered.map((p) => (
            <RowMenu
              key={p.metadata.uid}
              active={selected === p.metadata.name}
              onSelect={() => setSelected(p.metadata.name)}
              items={[
                { id: "open", label: "Open", onAction: () => setSelected(p.metadata.name) },
                { id: "copy", label: "Copy name", onAction: () => void copyText(p.metadata.name) },
                { id: "sep-1", label: "", onAction: () => {} },
                {
                  id: "delete",
                  label: "Delete…",
                  destructive: true,
                  onAction: () => {
                    setSelected(p.metadata.name);
                    setConfirmDelete(true);
                  },
                },
              ]}
              suffix={
                <StatusBadge tone={phaseTone(p.status?.phase)}>{p.status?.phase || "Unknown"}</StatusBadge>
              }
            >
              <div className="min-w-0 text-sm font-medium truncate">
                {p.metadata.name}
              </div>
            </RowMenu>
          ))}
        </ListPane>
        <DetailPane
          selectionKey={selected}
          empty={<DetailEmpty title="Select a pod" description="Stream logs or exec into a pod in this namespace." />}
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <DetailHeading>{selected}</DetailHeading>
                <StatusBadge tone={phaseTone(phase)}>{phase}</StatusBadge>
                <CopyButton value={selected || ""} label="Copy name" iconOnly />
              </div>
              <MoreActionsMenu label="More pod actions">
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                  Delete…
                </DropdownMenuItem>
              </MoreActionsMenu>
            </div>
          }
        >
          <Tabs
            aria-label="Pod details"
            value={podTab}
            onValueChange={(key) => setPodTab(key as "logs" | "exec" | "inspect")}
          >
            <TabsList>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="exec">Exec</TabsTrigger>
              <TabsTrigger value="inspect">Inspect</TabsTrigger>
            </TabsList>
            <TabsContent value="logs" className="mt-3">
              <ConsolePanel
                key={`${namespace}-${selected}-logs`}
                url={api.podLogsUrl(namespace, selected!, true)}
                title="Pod logs"
              />
            </TabsContent>
            <TabsContent value="exec" className="mt-3">
              <ExecTerminalLazy
                key={`${namespace}-${selected}`}
                wsUrl={api.podExecWsUrl(namespace, selected!)}
                title="Pod shell"
              />
            </TabsContent>
            <TabsContent value="inspect" className="mt-3">
              {selectedPod ? (
                <InspectFields
                  rows={[
                    { label: "Namespace", value: namespace, mono: true },
                    { label: "Node", value: selectedPod.spec?.nodeName, mono: true },
                    { label: "Pod IP", value: selectedPod.status?.podIP, mono: true, copy: selectedPod.status?.podIP },
                    {
                      label: "Containers",
                      value: (selectedPod.spec?.containers || [])
                        .map((c: any) => c.name)
                        .filter(Boolean)
                        .join(", "),
                    },
                    {
                      label: "Image",
                      value: selectedPod.spec?.containers?.[0]?.image,
                      mono: true,
                      copy: selectedPod.spec?.containers?.[0]?.image,
                    },
                    { label: "Restart policy", value: selectedPod.spec?.restartPolicy },
                    { label: "Created", value: selectedPod.metadata.creationTimestamp },
                    { label: "UID", value: selectedPod.metadata.uid, mono: true, copy: selectedPod.metadata.uid },
                  ]}
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </DetailPane>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete pod"
        description={`Delete pod “${selected}” from ${namespace}?`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!selected) return;
          await api.deletePod(namespace, selected);
          setSelected(null);
          qc.invalidateQueries({ queryKey: ["pods"] });
        }}
      />
    </K8sChrome>
  );
}
