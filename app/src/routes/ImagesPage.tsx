import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type ImageScanResult, type VolumeFileEntry } from "@/lib/api";
import {
  ActionMenu,
  Button,
  MenuItem,
  MenuSection,
  Text,
} from "@react-spectrum/s2";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { formatBytes, shortId } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

import { copyText } from "@/routes/shared";

function imageTitle(img: { Id?: string; RepoTags?: string[] | null; RepoDigests?: string[] | null }) {
  if (img.RepoTags?.[0]) return img.RepoTags[0];
  const digestRepo = img.RepoDigests?.[0]?.split("@")[0];
  if (digestRepo) return digestRepo;
  return shortId(img.Id?.replace(/^sha256:/, "") || img.Id);
}

function imageShortId(id?: string) {
  if (!id) return "";
  return shortId(id.replace(/^sha256:/, ""));
}

function formatCreated(ts?: number) {
  if (ts == null || !Number.isFinite(ts)) return undefined;
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return undefined;
  }
}

export function ImagesPage() {
  const qc = useQueryClient();
  const openRunSheet = useUIStore((s) => s.openRunSheet);
  const pendingImageId = useUIStore((s) => s.pendingImageId);
  const setPendingImageId = useUIStore((s) => s.setPendingImageId);
  const [ref, setRef] = useState("nginx:alpine");
  const [pullLog, setPullLog] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullOpen, setPullOpen] = useState(false);
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
        (img.RepoTags || []).some((t: string) => t.toLowerCase().includes(needle)) ||
        (img.RepoDigests || []).some((d: string) => d.toLowerCase().includes(needle)),
    );
  }, [list.data, q]);

  const selectedImg = filtered.find((img) => img.Id === selected) || (list.data || []).find((img) => img.Id === selected);
  const title = selectedImg ? imageTitle(selectedImg) : "";
  const dangling = !!selectedImg && !(selectedImg.RepoTags || []).length;
  const extraTags = (selectedImg?.RepoTags || []).slice(1);

  const runPull = async () => {
    const trimmed = ref.trim();
    if (!trimmed) return;
    setPulling(true);
    setPullLog("");
    setPullOpen(false);
    setSheetOpen(true);
    try {
      await api.pullImageStream(trimmed, (chunk) => {
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
      toast.success("Pull complete", { description: trimmed });
    } catch (e: any) {
      setPullLog((p) => p + `\n${e.message || "pull failed"}\n`);
      toast.error("Pull failed", { description: e?.message });
    } finally {
      setPulling(false);
    }
  };

  const runScan = async () => {
    if (!selected || !selectedImg) return;
    setScanning(true);
    try {
      const res = await api.scanImage(selected, selectedImg.RepoTags?.[0] || selected);
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
  };

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
      <ListPane
        title="Images"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No local images"}
            description={q ? "Try another tag or ID." : "Pull a tag to get started on this engine."}
            action={
              q ? undefined : (
                <Button size="S" onPress={() => setPullOpen(true)}>
                  Pull image
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search images" }}
        actions={
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })} data-no-drag>
            <Tip label="Remove unused (dangling) images from the local engine">
              <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setConfirmPrune(true)}>
                Prune
              </Button>
            </Tip>
            <Tip label="Pull an image from a registry">
              <Button size="S" onPress={() => setPullOpen(true)}>
                Pull
              </Button>
            </Tip>
          </div>
        }
      >
        {filtered.map((img) => {
          const name = imageTitle(img);
          const untagged = !(img.RepoTags || []).length;
          return (
            <RowMenu
              key={img.Id}
              active={selected === img.Id}
              onSelect={() => setSelected(img.Id)}
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
              suffix={
                untagged ? <StatusBadge tone="muted">dangling</StatusBadge> : null
              }
            >
              <div
                className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}
                title={name}
              >
                {name}
              </div>
              <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, minWidth: 0 })}>
                {formatBytes(img.Size)}
                {img.Id ? ` · ${imageShortId(img.Id)}` : ""}
              </div>
            </RowMenu>
          );
        })}
      </ListPane>

      <DetailPane
        selectionKey={selected}
        empty={
          <DetailEmpty
            title="Select an image"
            description="Inspect tags and size, browse layers, scan vulns — or pull a new tag."
            action={
              <Button size="S" onPress={() => setPullOpen(true)}>
                Pull image
              </Button>
            }
          />
        }
      >
        {selectedImg ? (
          <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 })}>
            <div
              className={style({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                minWidth: 0,
              })}
            >
              <div className={style({ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })}>
                  <DetailHeading>{title}</DetailHeading>
                  {dangling ? <StatusBadge tone="muted">dangling</StatusBadge> : null}
                </div>
                <div className={style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })}>
                  <div
                    className={style({
                      display: "inline-flex",
                      flexShrink: 0,
                      alignItems: "center",
                      gap: 2,
                    })}
                  >
                    <span className={style({ font: "code-xs", color: "neutral-subdued" })}>
                      {imageShortId(selectedImg.Id)}
                    </span>
                    <CopyButton value={selectedImg.Id} label="Copy ID" iconOnly />
                  </div>
                  <span className={style({ font: "code-xs", color: "neutral-subdued", truncate: true, minWidth: 0 })}>
                    {formatBytes(selectedImg.Size)}
                    {extraTags.length ? ` · +${extraTags.length} tag${extraTags.length === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
              </div>
              <div className={style({ display: "flex", flexShrink: 0, alignItems: "center", gap: 8 })}>
                {selectedImg.RepoTags?.[0] ? (
                  <Button size="S" variant="accent" onPress={() => openRunSheet(selectedImg.RepoTags![0])}>
                    Run
                  </Button>
                ) : null}
                <ActionMenu aria-label="More image actions" isQuiet align="end" size="S">
                  <MenuSection>
                    <MenuItem
                      id="browse"
                      textValue="Browse files"
                      onAction={() => {
                        setBrowsing(true);
                        setFilePath("");
                      }}
                    >
                      <Text slot="label">Browse files</Text>
                    </MenuItem>
                    <MenuItem
                      id="scan"
                      textValue="Scan vulnerabilities"
                      isDisabled={scanning}
                      onAction={() => void runScan()}
                    >
                      <Text slot="label">{scanning ? "Scanning…" : "Scan vulns"}</Text>
                    </MenuItem>
                  </MenuSection>
                  <MenuSection>
                    <MenuItem id="remove" textValue="Remove" onAction={() => setConfirmRemove(true)}>
                      <Text slot="label" styles={style({ color: "negative" })}>
                        Remove…
                      </Text>
                    </MenuItem>
                  </MenuSection>
                </ActionMenu>
              </div>
            </div>

            <InspectFields
              rows={[
                { label: "Size", value: formatBytes(selectedImg.Size) },
                { label: "Created", value: formatCreated(selectedImg.Created) },
                {
                  label: "Tags",
                  value: (selectedImg.RepoTags || []).length
                    ? (selectedImg.RepoTags || []).join(", ")
                    : "—",
                  mono: true,
                },
                {
                  label: "Digest",
                  value: selectedImg.RepoDigests?.[0]?.split("@")[1] || undefined,
                  mono: true,
                  copy: selectedImg.RepoDigests?.[0],
                },
              ]}
            />

            {scan ? (
              <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                <div className={style({ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 })}>
                  <div className={style({ font: "title-sm" })}>Vulnerability scan</div>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                    {scan.tool || "scanner"} · C{scan.critical} H{scan.high} M{scan.medium} L{scan.low}
                  </div>
                </div>
                {scan.error ? (
                  <div className={style({ font: "body-sm", color: "neutral-subdued" })}>{scan.error}</div>
                ) : null}
                {(scan.findings || []).length === 0 && scan.ok ? (
                  <div className={style({ font: "body-sm", color: "neutral-subdued" })}>No findings reported.</div>
                ) : (
                  <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
                    {(scan.findings || []).slice(0, 12).map((f) => (
                      <div
                        key={`${f.id}-${f.package}`}
                        className={style({
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          paddingX: 12,
                          paddingY: 8,
                          borderRadius: "lg",
                          backgroundColor: "gray-100",
                          minWidth: 0,
                        })}
                      >
                        <StatusBadge
                          tone={f.severity === "CRITICAL" || f.severity === "HIGH" ? "destructive" : "muted"}
                        >
                          {f.severity}
                        </StatusBadge>
                        <span className={style({ font: "code-xs", truncate: true, minWidth: 0 })}>
                          {f.id}
                          {f.package ? ` · ${f.package}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {browsing ? (
              <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}>
                  <div className={style({ font: "title-sm", flexGrow: 1 })}>Files</div>
                  <div className={style({ font: "code-xs", color: "neutral-subdued" })}>/{filePath || ""}</div>
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
                <div
                  className={style({
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    backgroundColor: "layer-1",
                    borderRadius: "xl",
                    padding: 8,
                  })}
                >
                  {files.isLoading ? (
                    <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0, padding: 8 })}>
                      Loading…
                    </p>
                  ) : files.isError ? (
                    <p className={style({ font: "body-xs", color: "negative", margin: 0, padding: 8 })}>
                      {(files.error as Error)?.message || "Failed to list files"}
                    </p>
                  ) : (files.data || []).length === 0 ? (
                    <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0, padding: 8 })}>
                      Empty directory
                    </p>
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
                          paddingX: 12,
                          paddingY: 8,
                          borderRadius: "lg",
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
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailPane>

      <GlassSheet
        open={pullOpen}
        onOpenChange={setPullOpen}
        title="Pull image"
        description="Fetch a tag from a registry into the local engine."
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setPullOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              isDisabled={!ref.trim() || pulling}
              isPending={pulling}
              onPress={() => void runPull()}
            >
              Pull
            </Button>
          </>
        }
      >
        <Field value={ref} onChange={setRef} placeholder="nginx:alpine" aria-label="Image reference" />
      </GlassSheet>

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
        description={`Remove “${selectedImg ? imageTitle(selectedImg) : shortId(selected || "")}”?`}
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
