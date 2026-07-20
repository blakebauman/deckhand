import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActionMenu, Button, MenuItem, MenuSection, Slider, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { SettingRow } from "@/components/SettingRow";
import { toast } from "@/components/Toaster";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { useUIStore } from "@/stores/uiStore";
import { copyText } from "@/routes/shared";
import { K8sChrome } from "@/routes/k8s/K8sChrome";

function readyTone(ready: number, desired: number) {
  return ready > 0 && ready === desired ? "success" : "muted";
}

export function DeploymentsPage() {
  const namespace = useUIStore((s) => s.namespace);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replicas, setReplicas] = useState(1);
  const list = useQuery({
    queryKey: ["deployments", namespace],
    queryFn: () => api.deployments(namespace),
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((d) => d.metadata.name?.toLowerCase().includes(needle));
  }, [list.data, q]);

  const row = filtered.find((d) => d.metadata.name === selected);
  const ready = row?.status?.readyReplicas ?? 0;
  const desired = row?.spec?.replicas ?? 0;

  useEffect(() => {
    setReplicas(row?.spec?.replicas ?? 1);
  }, [row?.metadata.name, row?.spec?.replicas]);

  return (
    <K8sChrome>
      <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
        <ListPane
          title="Deployments"
          loading={list.isLoading}
          empty={
            <ListEmpty
              title={q ? "No matches" : "No deployments"}
              description={q ? "Try another name." : `No deployments in “${namespace}”.`}
            />
          }
          search={{ value: q, onChange: setQ, placeholder: "Search deployments" }}
        >
          {filtered.map((d) => {
            const r = d.status?.readyReplicas ?? 0;
            const want = d.spec?.replicas ?? 0;
            return (
              <RowMenu
                key={d.metadata.uid}
                active={selected === d.metadata.name}
                onSelect={() => setSelected(d.metadata.name)}
                items={[
                  { id: "open", label: "Open", onAction: () => setSelected(d.metadata.name) },
                  { id: "copy", label: "Copy name", onAction: () => void copyText(d.metadata.name) },
                  {
                    id: "scale-up",
                    label: "Scale +",
                    onAction: () =>
                      void api
                        .scaleDeployment(namespace, d.metadata.name, (d.spec?.replicas || 1) + 1)
                        .then(() => qc.invalidateQueries({ queryKey: ["deployments"] })),
                  },
                  {
                    id: "restart",
                    label: "Restart",
                    onAction: () =>
                      void api
                        .restartDeployment(namespace, d.metadata.name)
                        .then(() => qc.invalidateQueries({ queryKey: ["deployments"] })),
                  },
                  { id: "sep-1", label: "", onAction: () => {} },
                  {
                    id: "delete",
                    label: "Delete…",
                    destructive: true,
                    onAction: () => {
                      setSelected(d.metadata.name);
                      setConfirmDelete(true);
                    },
                  },
                ]}
                suffix={
                  <StatusBadge tone={readyTone(r, want)}>
                    {r}/{want}
                  </StatusBadge>
                }
              >
                <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                  {d.metadata.name}
                </div>
              </RowMenu>
            );
          })}
        </ListPane>
        <DetailPane
          selectionKey={selected}
          empty={<DetailEmpty title="Select a deployment" description="Scale replicas or restart a deployment." />}
          header={
            row ? (
              <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 })}>
                <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0, flexGrow: 1 })}>
                  <DetailHeading>{row.metadata.name}</DetailHeading>
                  <StatusBadge tone={readyTone(ready, desired)}>
                    {ready}/{desired}
                  </StatusBadge>
                  <CopyButton value={row.metadata.name} label="Copy name" iconOnly />
                </div>
                <div className={style({ display: "flex", flexShrink: 0, alignItems: "center", gap: 8 })}>
                  <Button
                    size="S"
                    variant="secondary"
                    onPress={() =>
                      api
                        .restartDeployment(namespace, row.metadata.name)
                        .then(() => {
                          toast.success("Restarted");
                          qc.invalidateQueries({ queryKey: ["deployments"] });
                        })
                        .catch((e: any) => toast.error("Restart failed", { description: e?.message }))
                    }
                  >
                    Restart
                  </Button>
                  <ActionMenu aria-label="More deployment actions" isQuiet align="end" size="S">
                    <MenuSection>
                      <MenuItem
                        id="scale-up"
                        textValue="Scale +"
                        onAction={() =>
                          void api
                            .scaleDeployment(namespace, row.metadata.name, desired + 1)
                            .then(() => {
                              toast.success("Scaled", { description: `${row.metadata.name} → ${desired + 1}` });
                              qc.invalidateQueries({ queryKey: ["deployments"] });
                            })
                            .catch((e: any) => toast.error("Scale failed", { description: e?.message }))
                        }
                      >
                        <Text slot="label">Scale +</Text>
                      </MenuItem>
                    </MenuSection>
                    <MenuSection>
                      <MenuItem id="delete" textValue="Delete" onAction={() => setConfirmDelete(true)}>
                        <Text slot="label" styles={style({ color: "negative" })}>
                          Delete…
                        </Text>
                      </MenuItem>
                    </MenuSection>
                  </ActionMenu>
                </div>
              </div>
            ) : null
          }
        >
          {row ? (
            <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
              <div className={style({ backgroundColor: "layer-1", borderRadius: "xl" })}>
                <SettingRow
                  title="Replicas"
                  description="Drag to scale; releases on commit"
                  action={<span className={style({ font: "code-xs" })}>{replicas}</span>}
                >
                  <Slider
                    aria-label="Replicas"
                    minValue={0}
                    maxValue={Math.max(20, replicas, row.spec?.replicas || 0)}
                    step={1}
                    value={replicas}
                    onChange={setReplicas}
                    onChangeEnd={(v) => {
                      void api
                        .scaleDeployment(namespace, row.metadata.name, v)
                        .then(() => {
                          toast.success("Scaled", { description: `${row.metadata.name} → ${v}` });
                          qc.invalidateQueries({ queryKey: ["deployments"] });
                        })
                        .catch((e: any) => toast.error("Scale failed", { description: e?.message }));
                    }}
                  />
                </SettingRow>
              </div>
              <InspectFields
                rows={[
                  { label: "Namespace", value: namespace, mono: true },
                  {
                    label: "Strategy",
                    value: row.spec?.strategy?.type,
                  },
                  {
                    label: "Selector",
                    value: row.spec?.selector?.matchLabels
                      ? Object.entries(row.spec.selector.matchLabels)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")
                      : undefined,
                    mono: true,
                  },
                  {
                    label: "Image",
                    value: row.spec?.template?.spec?.containers?.[0]?.image,
                    mono: true,
                    copy: row.spec?.template?.spec?.containers?.[0]?.image,
                  },
                  { label: "Created", value: row.metadata.creationTimestamp },
                  { label: "UID", value: row.metadata.uid, mono: true, copy: row.metadata.uid },
                ]}
              />
            </div>
          ) : null}
        </DetailPane>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete deployment"
        description={`Delete deployment “${selected}” from ${namespace}?`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!selected) return;
          await api.deleteDeployment(namespace, selected);
          setSelected(null);
          qc.invalidateQueries({ queryKey: ["deployments"] });
        }}
      />
    </K8sChrome>
  );
}
