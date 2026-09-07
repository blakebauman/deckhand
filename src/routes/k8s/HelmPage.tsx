import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { ListEmpty } from "@/components/ListPane";
import { PageShell } from "@/components/PageShell";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { K8sChrome } from "@/routes/k8s/K8sChrome";
import { copyText } from "@/routes/shared";
import { useUIStore } from "@/stores/uiStore";

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
            <Button size="sm" onClick={() => setInstallOpen(true)}>
              Install
            </Button>
          </Tip>
        }
      >
        <div className="flex max-w-3xl flex-col gap-1">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading releases…</p>
          ) : releases.length === 0 ? (
            <ListEmpty
              title="No releases"
              description={`Nothing installed in “${namespace}” yet.`}
              action={
                <Button size="sm" onClick={() => setInstallOpen(true)}>
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
                        .then((res: any) =>
                          showOut(`Rollback · ${r.name}`, res.output || "rolled back"),
                        )
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
                  <StatusBadge tone={r.status === "deployed" ? "success" : "muted"}>
                    {r.status}
                  </StatusBadge>
                }
              >
                <div className="min-w-0 truncate text-sm font-medium">{r.name}</div>
                <div className="min-w-0 truncate text-xs text-muted-foreground">
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
            <Button variant="secondary" onClick={() => setInstallOpen(false)} disabled={installing}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!name.trim() || !chart.trim() || installing}
              onClick={async () => {
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
        <div className="flex flex-col gap-4">
          <Input
            aria-label="Release name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="demo"
          />
          <Input
            aria-label="Chart"
            value={chart}
            onChange={(e) => setChart(e.target.value)}
            placeholder="path or repo/chart"
          />
          <Textarea
            aria-label="Values"
            value={valuesYaml}
            onChange={(e) => setValuesYaml(e.target.value)}
            placeholder="values.yaml (optional)"
            className="w-full"
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
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
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
