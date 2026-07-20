import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type ImageScanResult, type VolumeFileEntry } from "@/lib/api";
import { Button } from "@react-spectrum/s2";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { formatBytes, shortId } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

import { copyText } from "@/routes/shared";

export function ImagesPage() {
  const qc = useQueryClient();
  const openRunSheet = useUIStore((s) => s.openRunSheet);
  const pendingImageId = useUIStore((s) => s.pendingImageId);
  const setPendingImageId = useUIStore((s) => s.setPendingImageId);
  const [ref, setRef] = useState("nginx:alpine");
  const [pullLog, setPullLog] = useState("");
  const [pulling, setPulling] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [scan, setScan] = useState<ImageScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const list = useQuery({ queryKey: ["images"], queryFn: api.images, refetchInterval: 8000 });
  const files = useQuery({
    queryKey: ["image-files", selected, filePath],
    queryFn: () => api.imageFiles(selected!, filePath),
    enabled: !!selected && browsing,
  });

  useEffect(() => {
    if (!pendingImageId) return;
    setSelected(pendingImageId);
    setPendingImageId(undefined);
  }, [pendingImageId, setPendingImageId]);

  useEffect(() => {
    setBrowsing(false);
    setFilePath("");
    setScan(null);
  }, [selected]);

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter(
      (img) =>
        img.Id?.toLowerCase().includes(needle) ||
        (img.RepoTags || []).some((t: string) => t.toLowerCase().includes(needle)),
    );
  }, [list.data, q]);

  const selectedImg = filtered.find((img) => img.Id === selected);

  const runPull = async () => {
    setPulling(true);
    setPullLog("");
    setSheetOpen(true);
    try {
      await api.pullImageStream(ref, (chunk) => {
        const lines = chunk.split("\n").filter(Boolean);
        const pretty = lines
          .map((line) => {
            try {
              const j = JSON.parse(line);
              if (j.status && j.progress) return `${j.id ? j.id + ": " : ""}${j.status} ${j.progress}`;
              if (j.status) return `${j.id ? j.id + ": " : ""}${j.status}`;
              if (j.error) return `error: ${j.error}`;
              return line;
            } catch {
              return line;
            }
          })
          .join("\n");
        setPullLog((prev) => (prev + pretty + "\n").slice(-200_000));
      });
      qc.invalidateQueries({ queryKey: ["images"] });
      setPullLog((p) => p + "\nPull complete.\n");
    } catch (e: any) {
      setPullLog((p) => p + `\n${e.message || "pull failed"}\n`);
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}>
      <ListPane
        title="Images"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No local images"}
            description={q ? "Try another tag or ID." : "Pull an image on the right to get started."}
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search images" }}
        actions={
          <Tip label="Remove unused (dangling) images from the local engine">
            <Button size="S" variant="secondary" fillStyle="outline" data-no-drag onPress={() => setConfirmPrune(true)}>
              Prune
            </Button>
          </Tip>
        }
      >
        {filtered.map((img) => (
          <RowMenu
            key={img.Id}
            items={[
              { id: "open", label: "Open", onAction: () => setSelected(img.Id) },
              ...(img.RepoTags?.[0]
                ? [{ id: "run", label: "Run…", onAction: () => openRunSheet(img.RepoTags![0]) }]
                : []),
              { id: "copy-id", label: "Copy ID", onAction: () => void copyText(img.Id) },
              ...(img.RepoTags?.[0]
                ? [{ id: "copy-tag", label: "Copy tag", onAction: () => void copyText(img.RepoTags![0]) }]
                : []),
              { id: "sep-1", label: "", onAction: () => {} },
              {
                id: "remove",
                label: "Remove…",
                onAction: () => {
                  setSelected(img.Id);
                  setConfirmRemove(true);
                },
                destructive: true,
              },
            ]}
          >
            <ListItem active={selected === img.Id} onClick={() => setSelected(img.Id)}>
              <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                {img.RepoTags?.[0] || shortId(img.Id)}
              </div>
              <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, marginTop: 2, minWidth: 0 })}>
                {formatBytes(img.Size)}
              </div>
            </ListItem>
          </RowMenu>
        ))}
      </ListPane>
      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          height: "full",
          gap: 16,
        })}
      >
        <DetailPane
          selectionKey={selected}
          empty={
            <DetailEmpty
              title="Select an image"
              description="Pull a tag below, or pick a local image to run or remove."
            />
          }
        >
          {selectedImg ? (
            <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 })}>
              <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "start", justifyContent: "space-between", gap: 8 })}>
                <div className={style({ minWidth: 0, flexGrow: 1 })}>
                  <DetailHeading>{selectedImg.RepoTags?.[0] || shortId(selectedImg.Id)}</DetailHeading>
                  <p className={style({ font: "code-xs", color: "neutral-subdued", marginTop: 4 })}>{shortId(selectedImg.Id)}</p>
                  <p className={style({ font: "body-sm", color: "neutral-subdued", marginTop: 4 })}>{formatBytes(selectedImg.Size)}</p>
                </div>
                <CopyButton value={selectedImg.Id} label="Copy ID" />
              </div>
              {(selectedImg.RepoTags || []).length > 1 ? (
                <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                  {selectedImg.RepoTags!.map((t: string) => (
                    <StatusBadge key={t} tone="muted">
                      {t}
                    </StatusBadge>
                  ))}
                </div>
              ) : null}
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                {selectedImg.RepoTags?.[0] ? (
                  <Button size="S" onPress={() => openRunSheet(selectedImg.RepoTags![0])}>
                    Run
                  </Button>
                ) : null}
                <Button
                  size="S"
                  variant="secondary"
                  fillStyle="outline"
                  onPress={() => {
                    setBrowsing(true);
                    setFilePath("");
                  }}
                >
                  Browse files
                </Button>
                <Tip label="Scan with Trivy or Grype if installed on PATH">
                  <Button
                    size="S"
                    variant="secondary"
                    fillStyle="outline"
                    isPending={scanning}
                    onPress={() => {
                      void (async () => {
                        if (!selected) return;
                        setScanning(true);
                        try {
                          const res = await api.scanImage(
                            selected,
                            selectedImg.RepoTags?.[0] || selected,
                          );
                          setScan(res);
                          if (!res.ok) {
                            toast.error("Scan unavailable", { description: res.error });
                          } else {
                            toast.success(`Scanned with ${res.tool}`, {
                              description: `${res.critical} critical · ${res.high} high`,
                            });
                          }
                        } catch (e: any) {
                          toast.error("Scan failed", { description: e?.message });
                        } finally {
                          setScanning(false);
                        }
                      })();
                    }}
                  >
                    Scan vulns
                  </Button>
                </Tip>
                <Button size="S" variant="negative" onPress={() => setConfirmRemove(true)}>
                  Remove
                </Button>
              </div>

              {scan ? (
                <div
                  className={style({
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    backgroundColor: "layer-1",
                    borderRadius: "xl",
                    padding: 12,
                  })}
                >
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                    {scan.tool || "scanner"} · C{scan.critical} H{scan.high} M{scan.medium} L{scan.low}
                    {scan.error ? ` · ${scan.error}` : ""}
                  </div>
                  {(scan.findings || []).slice(0, 12).map((f) => (
                    <div key={`${f.id}-${f.package}`} className={style({ font: "code-xs" })}>
                      <StatusBadge tone={f.severity === "CRITICAL" || f.severity === "HIGH" ? "destructive" : "muted"}>
                        {f.severity}
                      </StatusBadge>{" "}
                      {f.id} {f.package ? `· ${f.package}` : ""}
                    </div>
                  ))}
                </div>
              ) : null}

              {browsing ? (
                <div
                  className={style({
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    backgroundColor: "layer-1",
                    borderRadius: "xl",
                    padding: 12,
                  })}
                >
                  <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}>
                    <div className={style({ font: "body-xs", color: "neutral-subdued", flexGrow: 1 })}>
                      Files · /{filePath || ""}
                    </div>
                    <Button
                      size="S"
                      variant="secondary"
                      fillStyle="outline"
                      isDisabled={!filePath}
                      onPress={() => {
                        const parts = filePath.replace(/\/+$/, "").split("/");
                        parts.pop();
                        setFilePath(parts.join("/"));
                      }}
                    >
                      Up
                    </Button>
                    <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setBrowsing(false)}>
                      Close
                    </Button>
                  </div>
                  {files.isLoading ? (
                    <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0 })}>Loading…</p>
                  ) : files.isError ? (
                    <p className={style({ font: "body-xs", color: "negative", margin: 0 })}>
                      {(files.error as Error)?.message || "Failed to list files"}
                    </p>
                  ) : (files.data || []).length === 0 ? (
                    <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0 })}>Empty directory</p>
                  ) : (
                    (files.data || []).map((f: VolumeFileEntry) => (
                      <button
                        key={f.path}
                        type="button"
                        disabled={!f.dir}
                        onClick={() => {
                          if (f.dir) setFilePath(f.path);
                        }}
                        className={style({
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          paddingX: 8,
                          paddingY: 8,
                          borderRadius: "default",
                          borderStyle: "none",
                          backgroundColor: {
                            default: "transparent",
                            ":hover": "gray-100",
                          },
                          cursor: "pointer",
                          textAlign: "start",
                          color: "neutral",
                          width: "full",
                        })}
                      >
                        <span className={style({ font: "code-xs", truncate: true, minWidth: 0 })}>
                          {f.name}
                          {f.dir ? "/" : ""}
                        </span>
                        <span className={style({ font: "body-xs", color: "neutral-subdued", flexShrink: 0 })}>
                          {f.dir ? "dir" : formatBytes(f.size)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </DetailPane>
        <div
          className={style({
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            backgroundColor: "layer-1",
            borderRadius: "xl",
            padding: 16,
          })}
        >
          <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Pull image</div>
          <div className={style({ display: "flex", gap: 8, alignItems: "end" })}>
            <Field value={ref} onChange={setRef} placeholder="image:tag" />
            <Button onPress={() => void runPull()} isDisabled={pulling || !ref.trim()}>
              {pulling ? "Pulling…" : "Pull"}
            </Button>
          </div>
        </div>
      </div>

      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={pulling ? `Pulling ${ref}` : `Pull · ${ref}`}
        description="Live progress from the Docker engine"
        mono
        footer={
          <Button variant="secondary" fillStyle="outline" onPress={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={pullLog}>{pullLog || "Waiting for layers…"}</TerminalBlock>
      </GlassSheet>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove image"
        description={`Remove ${selectedImg?.RepoTags?.[0] || shortId(selected || "")}?`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!selected) return;
          try {
            await api.removeImage(selected);
            toast.success("Image removed");
            setSelected(null);
            qc.invalidateQueries({ queryKey: ["images"] });
          } catch (e: any) {
            toast.error("Remove failed", { description: e?.message });
          }
        }}
      />
      <ConfirmDialog
        open={confirmPrune}
        onOpenChange={setConfirmPrune}
        title="Prune unused images"
        description="Remove dangling images that are not tagged or referenced by a container."
        confirmLabel="Prune"
        destructive
        onConfirm={async () => {
          try {
            await api.pruneImages();
            toast.success("Unused images pruned");
            qc.invalidateQueries({ queryKey: ["images"] });
          } catch (e: any) {
            toast.error("Prune failed", { description: e?.message });
          }
        }}
      />
    </div>
  );
}
