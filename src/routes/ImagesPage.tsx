import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { Field } from "@/components/Field";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { api, type ImageScanResult, type VolumeFileEntry } from "@/lib/api";
import { formatBytes, shortId } from "@/lib/utils";
import { copyText } from "@/routes/shared";
import { useUIStore } from "@/stores/uiStore";

function imageTitle(img: {
  Id?: string;
  RepoTags?: string[] | null;
  RepoDigests?: string[] | null;
}) {
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

  const selectedImg =
    filtered.find((img) => img.Id === selected) ||
    (list.data || []).find((img) => img.Id === selected);
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
              if (j.status && j.progress)
                return `${j.id ? j.id + ": " : ""}${j.status} ${j.progress}`;
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
    <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
      <ListPane
        title="Images"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No local images"}
            description={q ? "Try another tag or ID." : "Pull a tag to get started on this engine."}
            action={
              q ? undefined : (
                <Button size="sm" onClick={() => setPullOpen(true)}>
                  Pull image
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search images" }}
        actions={
          <div className="flex items-center gap-2" data-no-drag>
            <Tip label="Remove unused (dangling) images from the local engine">
              <Button size="sm" variant="secondary" onClick={() => setConfirmPrune(true)}>
                Prune
              </Button>
            </Tip>
            <Tip label="Pull an image from a registry">
              <Button size="sm" onClick={() => setPullOpen(true)}>
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
                  ? [
                      {
                        id: "copy-tag",
                        label: "Copy tag",
                        onAction: () => void copyText(img.RepoTags![0]),
                      },
                    ]
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
              suffix={untagged ? <StatusBadge tone="muted">dangling</StatusBadge> : null}
            >
              <div className="min-w-0 truncate text-sm font-medium" title={name}>
                {name}
              </div>
              <div className="min-w-0 truncate text-xs text-muted-foreground">
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
              <Button size="sm" onClick={() => setPullOpen(true)}>
                Pull image
              </Button>
            }
          />
        }
      >
        {selectedImg ? (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <DetailHeading>{title}</DetailHeading>
                  {dangling ? <StatusBadge tone="muted">dangling</StatusBadge> : null}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="inline-flex shrink-0 items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {imageShortId(selectedImg.Id)}
                    </span>
                    <CopyButton value={selectedImg.Id} label="Copy ID" iconOnly />
                  </div>
                  <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                    {formatBytes(selectedImg.Size)}
                    {extraTags.length
                      ? ` · +${extraTags.length} tag${extraTags.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedImg.RepoTags?.[0] ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => openRunSheet(selectedImg.RepoTags![0])}
                  >
                    Run
                  </Button>
                ) : null}
                <MoreActionsMenu label="More image actions">
                  <DropdownMenuItem
                    onClick={() => {
                      setBrowsing(true);
                      setFilePath("");
                    }}
                  >
                    Browse files
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={scanning} onClick={() => void runScan()}>
                    {scanning ? "Scanning…" : "Scan vulns"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
                    Remove…
                  </DropdownMenuItem>
                </MoreActionsMenu>
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
              <div className="flex flex-col gap-2">
                <div className="flex justify-between gap-2">
                  <div className="text-sm font-semibold">Vulnerability scan</div>
                  <div className="text-muted-foreground text-xs">
                    {scan.tool || "scanner"} · C{scan.critical} H{scan.high} M{scan.medium} L
                    {scan.low}
                  </div>
                </div>
                {scan.error ? (
                  <div className="text-muted-foreground text-sm">{scan.error}</div>
                ) : null}
                {(scan.findings || []).length === 0 && scan.ok ? (
                  <div className="text-muted-foreground text-sm">No findings reported.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {(scan.findings || []).slice(0, 12).map((f) => (
                      <div
                        key={`${f.id}-${f.package}`}
                        className="flex items-center gap-2 px-3 py-2 min-w-0 bg-muted rounded-lg"
                      >
                        <StatusBadge
                          tone={
                            f.severity === "CRITICAL" || f.severity === "HIGH"
                              ? "destructive"
                              : "muted"
                          }
                        >
                          {f.severity}
                        </StatusBadge>
                        <span className="min-w-0 font-mono text-xs truncate">
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
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 text-sm font-semibold">Files</div>
                  <div className="font-mono text-xs text-muted-foreground">/{filePath || ""}</div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!filePath}
                    onClick={() => {
                      const parts = filePath.replace(/\/+$/, "").split("/");
                      parts.pop();
                      setFilePath(parts.join("/"));
                    }}
                  >
                    Up
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setBrowsing(false)}>
                    Close
                  </Button>
                </div>
                <div className="flex flex-col gap-1 p-2 bg-card rounded-2xl">
                  {files.isLoading ? (
                    <p className="p-2 m-0 text-muted-foreground text-xs">Loading…</p>
                  ) : files.isError ? (
                    <p className="p-2 m-0 text-destructive text-xs">
                      {(files.error as Error)?.message || "Failed to list files"}
                    </p>
                  ) : (files.data || []).length === 0 ? (
                    <p className="p-2 m-0 text-muted-foreground text-xs">Empty directory</p>
                  ) : (
                    (files.data || []).map((f: VolumeFileEntry) => (
                      <button
                        key={f.path}
                        type="button"
                        disabled={!f.dir}
                        onClick={() => {
                          if (f.dir) setFilePath(f.path);
                        }}
                        className="flex items-center justify-between gap-2 px-3 py-2 w-full bg-transparent hover:bg-muted text-foreground rounded-lg border-0 cursor-pointer text-start"
                      >
                        <span className="min-w-0 font-mono text-xs truncate">
                          {f.name}
                          {f.dir ? "/" : ""}
                        </span>
                        <span className="shrink-0 text-muted-foreground text-xs">
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
            <Button variant="secondary" onClick={() => setPullOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!ref.trim() || pulling}
              onClick={() => void runPull()}
            >
              Pull
            </Button>
          </>
        }
      >
        <Field
          value={ref}
          onChange={setRef}
          placeholder="nginx:alpine"
          aria-label="Image reference"
        />
      </GlassSheet>

      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={pulling ? `Pulling ${ref}` : `Pull · ${ref}`}
        description="Live progress from the Docker engine"
        mono
        footer={
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
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
