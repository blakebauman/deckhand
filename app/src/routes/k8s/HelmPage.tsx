import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, TextArea, TextField } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListEmpty } from "@/components/ListPane";
import { PageShell } from "@/components/PageShell";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { toast } from "@/components/Toaster";
import { useUIStore } from "@/stores/uiStore";
import { copyText } from "@/routes/shared";
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
  const [installOpen, setInstallOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
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

  const releases = list.data || [];

  return (
    <K8sChrome>
      <PageShell
        title="Helm"
        description="Install and manage chart releases in the selected namespace."
        actions={
          <Tip label="Install a chart into this namespace">
            <Button size="S" onPress={() => setInstallOpen(true)}>
              Install
            </Button>
          </Tip>
        }
      >
        <div className={style({ display: "flex", flexDirection: "column", gap: 4, maxWidth: 720 })}>
          {list.isLoading ? (
            <p className={style({ font: "body-sm", color: "neutral-subdued" })}>Loading releases…</p>
          ) : releases.length === 0 ? (
            <ListEmpty
              title="No releases"
              description={`Nothing installed in “${namespace}” yet.`}
              action={
                <Button size="S" onPress={() => setInstallOpen(true)}>
                  Install chart
                </Button>
              }
            />
          ) : (
            releases.map((r) => (
              <RowMenu
                key={`${r.namespace}-${r.name}`}
                items={[
                  {
                    id: "rollback",
                    label: "Rollback",
                    onAction: () =>
                      void api
                        .helmRollback(r.namespace, r.name)
                        .then((res: any) => showOut(`Rollback · ${r.name}`, res.output || "rolled back"))
                        .catch((e: any) => showOut(`Rollback · ${r.name}`, e?.message || "failed")),
                  },
                  { id: "copy", label: "Copy name", onAction: () => void copyText(r.name) },
                  { id: "sep-1", label: "", onAction: () => {} },
                  {
                    id: "uninstall",
                    label: "Uninstall…",
                    destructive: true,
                    onAction: () => setConfirmUninstall(r.name),
                  },
                ]}
                suffix={
                  <StatusBadge tone={r.status === "deployed" ? "success" : "muted"}>{r.status}</StatusBadge>
                }
              >
                <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                  {r.name}
                </div>
                <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, minWidth: 0 })}>
                  {r.chart} · rev {r.revision}
                </div>
              </RowMenu>
            ))
          )}
        </div>
      </PageShell>

      <GlassSheet
        open={installOpen}
        onOpenChange={setInstallOpen}
        title="Install chart"
        description={`Release into namespace “${namespace}”.`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setInstallOpen(false)} isDisabled={installing}>
              Cancel
            </Button>
            <Button
              variant="accent"
              isDisabled={!name.trim() || !chart.trim() || installing}
              isPending={installing}
              onPress={async () => {
                setInstalling(true);
                try {
                  const res: any = await api.helmInstall({
                    name,
                    namespace,
                    chart,
                    valuesYaml,
                    createNamespace: true,
                  });
                  setInstallOpen(false);
                  showOut(`Install · ${name}`, res.output || "installed");
                  toast.success("Installed", { description: name });
                  qc.invalidateQueries({ queryKey: ["helm"] });
                } catch (e: any) {
                  showOut(`Install · ${name}`, e.message);
                  toast.error("Install failed", { description: e?.message });
                } finally {
                  setInstalling(false);
                }
              }}
            >
              Install
            </Button>
          </>
        }
      >
        <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
          <TextField label="Release name" value={name} onChange={setName} placeholder="demo" />
          <TextField
            label="Chart"
            value={chart}
            onChange={setChart}
            placeholder="path or repo/chart"
          />
          <TextArea
            label="Values"
            value={valuesYaml}
            onChange={setValuesYaml}
            placeholder="values.yaml (optional)"
            styles={style({ width: "full" })}
          />
        </div>
      </GlassSheet>

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
          try {
            const res: any = await api.helmUninstall(namespace, confirmUninstall);
            showOut(`Uninstall · ${confirmUninstall}`, res.output || "uninstalled");
            toast.success("Uninstalled", { description: confirmUninstall });
            setConfirmUninstall(null);
            qc.invalidateQueries({ queryKey: ["helm"] });
          } catch (e: any) {
            toast.error("Uninstall failed", { description: e?.message });
          }
        }}
      />
    </K8sChrome>
  );
}
