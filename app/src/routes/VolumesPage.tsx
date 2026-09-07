import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type VolumeFileEntry } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet } from "@/components/GlassSheet";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/Field";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { formatBytes } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

import { copyText } from "@/routes/shared";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";


function driverTone(driver?: string): "info" | "muted" | "default" {
  switch ((driver || "").toLowerCase()) {
    case "local":
      return "info";
    case "tmpfs":
    case "nfs":
      return "muted";
    default:
      return "default";
  }
}

export function VolumesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloning, setCloning] = useState(false);
  const pendingVolumeName = useUIStore((s) => s.pendingVolumeName);
  const setPendingVolumeName = useUIStore((s) => s.setPendingVolumeName);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [cloneDest, setCloneDest] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const list = useQuery({ queryKey: ["volumes"], queryFn: api.volumes });
  const detail = useQuery({
    queryKey: ["volume", selected],
    queryFn: () => api.volume(selected!),
    enabled: !!selected,
  });
  const files = useQuery({
    queryKey: ["volume-files", selected, filePath],
    queryFn: () => api.volumeFiles(selected!, filePath),
    enabled: !!selected && browsing,
  });

  useEffect(() => {
    if (!pendingVolumeName) return;
    setSelected(pendingVolumeName);
    setPendingVolumeName(undefined);
  }, [pendingVolumeName, setPendingVolumeName]);

  useEffect(() => {
    setFilePath("");
    setBrowsing(false);
    setShowRaw(false);
    setShowLabels(false);
    setCloneDest(selected ? `${selected}-copy` : "");
  }, [selected]);

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter(
      (v) =>
        v.Name?.toLowerCase().includes(needle) ||
        v.Driver?.toLowerCase().includes(needle) ||
        v.Mountpoint?.toLowerCase().includes(needle),
    );
  }, [list.data, q]);

  const row = filtered.find((v) => v.Name === selected) || (list.data || []).find((v) => v.Name === selected);
  const insp = detail.data || row;
  const displayName = insp?.Name || selected || "";
  const size =
    insp?.UsageData?.Size != null && insp.UsageData.Size >= 0
      ? formatBytes(insp.UsageData.Size)
      : undefined;
  const refCount =
    insp?.UsageData?.RefCount != null ? String(insp.UsageData.RefCount) : undefined;
  const labelCount = Object.keys(insp?.Labels || {}).length;
  const optionCount = Object.keys(insp?.Options || {}).length;

  const openDir = (entry: VolumeFileEntry) => {
    if (!entry.dir) return;
    setFilePath(entry.path);
  };

  const goUp = () => {
    if (!filePath) return;
    const parts = filePath.replace(/\/+$/, "").split("/");
    parts.pop();
    setFilePath(parts.join("/"));
  };

  const createVolume = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await api.createVolume(trimmed);
      setSelected(trimmed);
      setName("");
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ["volumes"] });
      toast.success("Volume created", { description: trimmed });
    } catch (e: any) {
      toast.error("Create failed", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const cloneVolume = async () => {
    if (!selected) return;
    const dest = cloneDest.trim();
    if (!dest || dest === selected) return;
    setCloning(true);
    try {
      await api.cloneVolume(selected, dest);
      toast.success("Volume cloned", { description: dest });
      setCloneOpen(false);
      await qc.invalidateQueries({ queryKey: ["volumes"] });
      setSelected(dest);
    } catch (e: any) {
      toast.error("Clone failed", { description: e?.message });
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
      <ListPane
        title="Volumes"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No named volumes"}
            description={q ? "Try another name or driver." : "Create a volume to persist container data."}
            action={
              q ? undefined : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create volume
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search volumes" }}
        actions={
          <Tip label="Create a named Docker volume">
            <Button size="sm" data-no-drag onClick={() => setCreateOpen(true)}>
              Create
            </Button>
          </Tip>
        }
      >
        {filtered.map((v) => (
          <RowMenu
            key={v.Name}
            active={selected === v.Name}
            onSelect={() => setSelected(v.Name)}
            items={[
              { id: "open", label: "Open", onAction: () => setSelected(v.Name) },
              { id: "copy-name", label: "Copy name", onAction: () => void copyText(v.Name) },
              { id: "sep-1", label: "", onAction: () => {} },
              {
                id: "remove",
                label: "Remove…",
                onAction: () => {
                  setSelected(v.Name);
                  setConfirmRemove(true);
                },
                destructive: true,
              },
            ]}
            suffix={<StatusBadge tone={driverTone(v.Driver)}>{v.Driver || "—"}</StatusBadge>}
          >
            <div className="min-w-0 text-sm font-medium truncate">
              {v.Name}
            </div>
            <div className="min-w-0 text-muted-foreground text-xs truncate">
              {v.UsageData?.Size != null && v.UsageData.Size >= 0
                ? formatBytes(v.UsageData.Size)
                : v.Mountpoint || "named volume"}
            </div>
          </RowMenu>
        ))}
      </ListPane>

      <DetailPane
        selectionKey={selected}
        empty={
          <DetailEmpty
            title="Select a volume"
            description="Inspect mountpoint and usage, browse files, or create a new named volume."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create volume
              </Button>
            }
          />
        }
      >
        {insp ? (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <DetailHeading>{displayName}</DetailHeading>
                  <StatusBadge tone={driverTone(insp.Driver)}>{insp.Driver || "—"}</StatusBadge>
                  <CopyButton value={displayName} label="Copy name" iconOnly />
                </div>
                <div
                  className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                  title={insp.Mountpoint}
                >
                  {[
                    size,
                    refCount != null ? `${refCount} refs` : null,
                    insp.Scope,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setBrowsing(true);
                    setFilePath("");
                  }}
                >
                  Browse
                </Button>
                <MoreActionsMenu label="More volume actions">
                  <DropdownMenuItem
                    onClick={() => {
                      window.open(api.volumeExportUrl(selected!), "_blank", "noopener,noreferrer");
                    }}
                  >
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => importRef.current?.click()}>Import…</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCloneDest(selected ? `${selected}-copy` : "");
                      setCloneOpen(true);
                    }}
                  >
                    Clone…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
                    Remove…
                  </DropdownMenuItem>
                </MoreActionsMenu>
                <input
                  ref={importRef}
                  type="file"
                  accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file || !selected) return;
                    void api
                      .importVolume(selected, file)
                      .then(() => {
                        toast.success("Import complete", { description: selected });
                        void files.refetch();
                      })
                      .catch((err: any) =>
                        toast.error("Import failed", { description: err?.message }),
                      );
                  }}
                />
              </div>
            </div>

            <InspectFields
              rows={[
                { label: "Mountpoint", value: insp.Mountpoint, copy: insp.Mountpoint, mono: true },
                { label: "Scope", value: insp.Scope },
                { label: "Created", value: insp.CreatedAt },
                { label: "Size", value: size },
                { label: "Ref count", value: refCount },
              ]}
            />

            {browsing ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 text-sm font-semibold">Files</div>
                  <div className="font-mono text-xs text-muted-foreground">/{filePath || ""}</div>
                  <Button size="sm" variant="secondary" disabled={!filePath} onClick={goUp}>
                    Up
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setBrowsing(false)}>
                    Close
                  </Button>
                </div>
                <div
                  className="flex flex-col gap-1 p-2 bg-card rounded-2xl"
                >
                  {files.isLoading ? (
                    <p className="p-2 m-0 text-muted-foreground text-xs">
                      Loading…
                    </p>
                  ) : files.isError ? (
                    <p className="p-2 m-0 text-destructive text-xs">
                      {(files.error as Error)?.message || "Failed to list files"}
                    </p>
                  ) : (files.data || []).length === 0 ? (
                    <p className="p-2 m-0 text-muted-foreground text-xs">
                      Empty directory
                    </p>
                  ) : (
                    (files.data || []).map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        disabled={!f.dir}
                        onClick={() => openDir(f)}
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

            <div className="flex flex-wrap items-center gap-2">
              {labelCount + optionCount > 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowLabels((v) => !v)}
                >
                  {showLabels ? "Hide labels" : `Labels (${labelCount + optionCount})`}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide JSON" : "Inspect JSON"}
              </Button>
            </div>
            {showLabels ? (
              <div className="flex flex-col gap-3">
                {optionCount > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-muted-foreground text-xs">Options</div>
                    <LabelChips labels={insp.Options} />
                  </div>
                ) : null}
                {labelCount > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-muted-foreground text-xs">Labels</div>
                    <LabelChips labels={insp.Labels} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {showRaw ? (
              <CodeBlock title="Inspect" meta="volume" value={JSON.stringify(detail.data || insp, null, 2)} />
            ) : null}
          </div>
        ) : null}
      </DetailPane>

      <GlassSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create volume"
        description="Named volume for persistent container data on this engine."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!name.trim() || creating}
              onClick={() => void createVolume()}
            >
              Create
            </Button>
          </>
        }
      >
        <Field value={name} onChange={setName} placeholder="my-data" aria-label="Volume name" />
      </GlassSheet>

      <GlassSheet
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        title="Clone volume"
        description={`Copy data from “${displayName}” into a new named volume.`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!cloneDest.trim() || cloneDest.trim() === selected || cloning}
              onClick={() => void cloneVolume()}
            >
              Clone
            </Button>
          </>
        }
      >
        <Field
          value={cloneDest}
          onChange={setCloneDest}
          placeholder="destination-name"
          aria-label="Clone destination name"
        />
      </GlassSheet>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove volume"
        description={`Delete volume “${selected}”? Data on the volume will be lost.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!selected) return;
          try {
            await api.removeVolume(selected);
            toast.success("Volume removed", { description: selected });
            setSelected(null);
            qc.invalidateQueries({ queryKey: ["volumes"] });
          } catch (e: any) {
            toast.error("Remove failed", { description: e?.message });
          }
        }}
      />
    </div>
  );
}
