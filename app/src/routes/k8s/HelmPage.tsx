import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, TextArea, TextField } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { useUIStore } from "@/stores/uiStore";
import { K8sChrome } from "@/routes/k8s/K8sChrome";

export function HelmPage() {
  const namespace = useUIStore((s) => s.namespace);
  const qc = useQueryClient();
  const [name, setName] = useState("demo");
  const [chart, setChart] = useState("");
  const [valuesYaml, setValuesYaml] = useState("");
  const [output, setOutput] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("Helm");
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["helm", namespace],
    queryFn: () => api.helmReleases(namespace, false),
    refetchInterval: 8000,
  });

  const showOut = (title: string, text: string) => {
    setSheetTitle(title);
    setOutput(text);
    setSheetOpen(true);
  };

  return (
    <K8sChrome>
      <PageShell title="Helm" description="Install and manage chart releases in the selected namespace.">
        <div
          className={style({
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginBottom: 24,
            backgroundColor: "layer-1",
            borderRadius: "xl",
            padding: 16,
          })}
        >
          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                sm: "1fr 1fr",
              },
              gap: 16,
            })}
          >
            <TextField label="Release name" value={name} onChange={setName} placeholder="demo" />
            <TextField
              label="Chart"
              value={chart}
              onChange={setChart}
              placeholder="path or repo/chart"
            />
          </div>
          <TextArea
            label="Values"
            value={valuesYaml}
            onChange={setValuesYaml}
            placeholder="values.yaml (optional)"
            styles={style({ width: "full" })}
          />
          <div>
            <Button
              size="S"
              isDisabled={!name.trim() || !chart.trim()}
              onPress={async () => {
                try {
                  const res: any = await api.helmInstall({
                    name,
                    namespace,
                    chart,
                    valuesYaml,
                    createNamespace: true,
                  });
                  showOut(`Install · ${name}`, res.output || "installed");
                  qc.invalidateQueries({ queryKey: ["helm"] });
                } catch (e: any) {
                  showOut(`Install · ${name}`, e.message);
                }
              }}
            >
              Install
            </Button>
          </div>
        </div>

        <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
          {(list.data || []).length === 0 ? (
            <p className={style({ font: "body-sm", color: "neutral-subdued" })}>
              No releases in “{namespace}”.
            </p>
          ) : (
            (list.data || []).map((r) => (
              <div
                key={`${r.namespace}-${r.name}`}
                className={style({
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  backgroundColor: "layer-1",
                  borderRadius: "xl",
                  borderWidth: 0,
                  paddingX: 16,
                  paddingY: 12,
                })}
              >
                <div className={style({ minWidth: 0, flexGrow: 1, display: "flex", alignItems: "center", gap: 8 })}>
                  <div className={style({ minWidth: 0, flexGrow: 1 })}>
                    <div className={style({ fontWeight: "medium", truncate: true, minWidth: 0 })}>{r.name}</div>
                    <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, marginTop: 2 })}>
                      {r.chart} · rev {r.revision}
                    </div>
                  </div>
                  <div className={style({ flexShrink: 0 })}>
                    <StatusBadge tone={r.status === "deployed" ? "success" : "muted"}>{r.status}</StatusBadge>
                  </div>
                </div>
                <div className={style({ display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 })}>
                  <Button
                    size="S"
                    variant="secondary"
                    fillStyle="outline"
                    onPress={() =>
                      api
                        .helmRollback(r.namespace, r.name)
                        .then((res: any) => showOut(`Rollback · ${r.name}`, res.output || "rolled back"))
                    }
                  >
                    Rollback
                  </Button>
                  <Button size="S" variant="negative" onPress={() => setConfirmUninstall(r.name)}>
                    Uninstall
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PageShell>
      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetTitle}
        description={namespace}
        mono
        footer={
          <Button variant="secondary" fillStyle="outline" onPress={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={output}>{output || "…"}</TerminalBlock>
      </GlassSheet>
      <ConfirmDialog
        open={!!confirmUninstall}
        onOpenChange={(o) => !o && setConfirmUninstall(null)}
        title="Uninstall release"
        description={`Uninstall Helm release “${confirmUninstall}” from ${namespace}?`}
        confirmLabel="Uninstall"
        destructive
        onConfirm={async () => {
          if (!confirmUninstall) return;
          const res: any = await api.helmUninstall(namespace, confirmUninstall);
          showOut(`Uninstall · ${confirmUninstall}`, res.output || "uninstalled");
          setConfirmUninstall(null);
          qc.invalidateQueries({ queryKey: ["helm"] });
        }}
      />
    </K8sChrome>
  );
}
