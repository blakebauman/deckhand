import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button, Tab, TabList, TabPanel, Tabs } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConsolePanel } from "@/components/ConsolePanel";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { ExecTerminal } from "@/components/ExecTerminal";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { useUIStore } from "@/stores/uiStore";
import { copyText } from "@/routes/shared";
import { K8sChrome } from "@/routes/k8s/K8sChrome";

export function PodsPage() {
  const namespace = useUIStore((s) => s.namespace);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [podTab, setPodTab] = useState<"logs" | "exec">("logs");
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

  return (
    <K8sChrome>
      <div className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}>
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
                <StatusBadge tone={p.status?.phase === "Running" ? "success" : "muted"}>
                  {p.status?.phase || "Unknown"}
                </StatusBadge>
              }
            >
              <ListItem active={selected === p.metadata.name} onClick={() => setSelected(p.metadata.name)}>
                <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                  {p.metadata.name}
                </div>
              </ListItem>
            </RowMenu>
          ))}
        </ListPane>
        <DetailPane
          selectionKey={selected}
          empty={<DetailEmpty title="Select a pod" description="Stream logs or exec into a pod in this namespace." />}
          header={
            <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 })}>
              <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0, flexGrow: 1 })}>
                <div className={style({ minWidth: 0, flexGrow: 1 })}>
                  <DetailHeading>{selected}</DetailHeading>
                </div>
                <StatusBadge tone={selectedPod?.status?.phase === "Running" ? "success" : "muted"}>
                  {selectedPod?.status?.phase || "Unknown"}
                </StatusBadge>
                <CopyButton value={selected || ""} label="Copy name" iconOnly />
              </div>
              <Button size="S" variant="negative" onPress={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </div>
          }
        >
          <Tabs
            aria-label="Pod details"
            selectedKey={podTab}
            onSelectionChange={(key) => setPodTab(key as "logs" | "exec")}
          >
            <TabList>
              <Tab id="logs">Logs</Tab>
              <Tab id="exec">Exec</Tab>
            </TabList>
            <TabPanel id="logs" styles={style({ marginTop: 12 })}>
              <ConsolePanel
                key={`${namespace}-${selected}-logs`}
                url={api.podLogsUrl(namespace, selected!, true)}
                title="Pod logs"
              />
            </TabPanel>
            <TabPanel id="exec" styles={style({ marginTop: 12 })}>
              <ExecTerminal
                key={`${namespace}-${selected}`}
                wsUrl={api.podExecWsUrl(namespace, selected!)}
                title="Pod shell"
              />
            </TabPanel>
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
