import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type VolumeFileEntry } from "@/lib/api";
import { Button } from "@react-spectrum/s2";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { formatBytes } from "@/lib/utils";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

import { copyText } from "@/routes/shared";

export function VolumesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
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
    setFilePath("");
    setBrowsing(false);
    setCloneDest(selected ? `${selected}-copy` : "");
  }, [selected]);

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((v) => v.Name?.toLowerCase().includes(needle) || v.Driver?.toLowerCase().includes(needle));
  }, [list.data, q]);

  const row = filtered.find((v) => v.Name === selected);
  const insp = detail.data || row;

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

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}>
      <ListPane
        title="Volumes"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No named volumes"}
            description={q ? "Try another name." : "Create a volume on the right to persist container data."}
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search volumes" }}
      >
        {filtered.map((v) => (
          <RowMenu
            key={v.Name}
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
          >
            <ListItem active={selected === v.Name} onClick={() => setSelected(v.Name)}>
              <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>{v.Name}</div>
              <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, marginTop: 2, minWidth: 0 })}>
                {v.Driver}
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
          empty={<DetailEmpty title="Select a volume" description="Inspect a named volume, or create one below." />}
        >
          {insp ? (
            <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 })}>
              <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "start", justifyContent: "space-between", gap: 8 })}>
                <div className={style({ minWidth: 0, flexGrow: 1 })}>
                  <DetailHeading>{insp.Name || selected}</DetailHeading>
                  <p className={style({ font: "body-sm", color: "neutral-subdued", marginTop: 4 })}>Driver · {insp.Driver || "—"}</p>
                </div>
                <CopyButton value={insp.Name || selected || ""} label="Copy name" />
              </div>
              <InspectFields
                rows={[
                  { label: "Mountpoint", value: insp.Mountpoint, copy: insp.Mountpoint, mono: true },
                  { label: "Scope", value: insp.Scope },
                  { label: "Created", value: insp.CreatedAt },
                  {
                    label: "Size",
                    value:
                      insp.UsageData?.Size != null && insp.UsageData.Size >= 0
                        ? formatBytes(insp.UsageData.Size)
                        : undefined,
                  },
                  {
                    label: "Ref count",
                    value: insp.UsageData?.RefCount != null ? String(insp.UsageData.RefCount) : undefined,
                  },
                ]}
              />
              {Object.keys(insp.Options || {}).length ? (
                <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Options</div>
                  <LabelChips labels={insp.Options} />
                </div>
              ) : null}
              {Object.keys(insp.Labels || {}).length ? (
                <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Labels</div>
                  <LabelChips labels={insp.Labels} />
                </div>
              ) : null}

              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                <Button
                  size="S"
                  variant="secondary"
                  onPress={() => {
                    setBrowsing(true);
                    setFilePath("");
                  }}
                >
                  Browse files
                </Button>
                <Button
                  size="S"
                  variant="secondary"
                  fillStyle="outline"
                  onPress={() => {
                    window.open(api.volumeExportUrl(selected!), "_blank", "noopener,noreferrer");
                  }}
                >
                  Export
                </Button>
                <Button size="S" variant="secondary" fillStyle="outline" onPress={() => importRef.current?.click()}>
                  Import
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".tar,.tar.gz,.tgz,application/x-tar,application/gzip"
                  className={style({ display: "none" })}
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
                <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setShowRaw((v) => !v)}>
                  {showRaw ? "Hide JSON" : "Inspect JSON"}
                </Button>
                <Button size="S" variant="negative" onPress={() => setConfirmRemove(true)}>
                  Remove
                </Button>
              </div>

              <div
                className={style({
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "end",
                  backgroundColor: "layer-2",
                  borderRadius: "xl",
                  padding: 12,
                })}
              >
                <div className={style({ flexGrow: 1, minWidth: 160 })}>
                  <Field
                    value={cloneDest}
                    onChange={setCloneDest}
                    placeholder="clone destination name"
                    aria-label="Clone destination"
                  />
                </div>
                <Button
                  size="S"
                  isDisabled={!cloneDest.trim() || cloneDest.trim() === selected}
                  onPress={() => {
                    if (!selected) return;
                    void api
                      .cloneVolume(selected, cloneDest.trim())
                      .then(async () => {
                        toast.success("Volume cloned", { description: cloneDest.trim() });
                        await qc.invalidateQueries({ queryKey: ["volumes"] });
                        setSelected(cloneDest.trim());
                      })
                      .catch((e: any) => toast.error("Clone failed", { description: e?.message }));
                  }}
                >
                  Clone
                </Button>
              </div>

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
                    <Button size="S" variant="secondary" fillStyle="outline" isDisabled={!filePath} onPress={goUp}>
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
                    (files.data || []).map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        disabled={!f.dir}
                        onClick={() => openDir(f)}
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

              {showRaw ? (
                <div className={style({ position: "relative" })}>
                  <div className={style({ position: "absolute", top: 12, insetEnd: 12, zIndex: 10 })}>
                    <CopyButton value={JSON.stringify(detail.data || insp, null, 2)} label="Copy JSON" />
                  </div>
                  <pre
                    className={style({
                      backgroundColor: "layer-1",
                      borderRadius: "xl",
                      padding: 16,
                      paddingTop: 48,
                      font: "code-xs",
                      maxHeight: "100%",
                      overflow: "auto",
                    })}
                  >
                    {JSON.stringify(detail.data || insp, null, 2)}
                  </pre>
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
          <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Create volume</div>
          <div className={style({ display: "flex", gap: 8, alignItems: "end" })}>
            <Field value={name} onChange={setName} placeholder="volume name" />
            <Button
              isDisabled={!name.trim()}
              onPress={() =>
                api
                  .createVolume(name)
                  .then(() => {
                    setSelected(name);
                    setName("");
                    qc.invalidateQueries({ queryKey: ["volumes"] });
                    toast.success("Volume created", { description: name });
                  })
                  .catch((e: any) => toast.error("Create failed", { description: e?.message }))
              }
            >
              Create
            </Button>
          </div>
        </div>
      </div>
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
