import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Picker, PickerItem } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet } from "@/components/GlassSheet";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { shortId } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

import { copyText } from "@/routes/shared";

function driverTone(driver?: string): "info" | "muted" | "accent" | "default" {
  switch ((driver || "").toLowerCase()) {
    case "bridge":
      return "info";
    case "overlay":
      return "accent";
    case "host":
    case "none":
      return "muted";
    default:
      return "default";
  }
}

export function NetworksPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setPendingContainerId = useUIStore((s) => s.setPendingContainerId);
  const setMode = useUIStore((s) => s.setMode);
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("bridge");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const list = useQuery({ queryKey: ["networks"], queryFn: api.networks });
  const detail = useQuery({
    queryKey: ["network", selected],
    queryFn: () => api.network(selected!),
    enabled: !!selected,
  });

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter(
      (n) =>
        n.Name?.toLowerCase().includes(needle) ||
        n.Driver?.toLowerCase().includes(needle) ||
        n.Id?.toLowerCase().includes(needle) ||
        n.Scope?.toLowerCase().includes(needle),
    );
  }, [list.data, q]);

  const row = filtered.find((n) => n.Id === selected);
  const insp = detail.data || row;
  const ipam = insp?.IPAM?.Config?.[0];
  const attached = Object.entries(insp?.Containers || {}) as [string, any][];

  const createNetwork = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await api.createNetwork(trimmed, driver);
      setSelected(res.Id);
      setName("");
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ["networks"] });
      toast.success("Network created", { description: `${trimmed} (${driver})` });
    } catch (e: any) {
      toast.error("Create failed", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const openContainer = (id: string) => {
    setMode("docker");
    setPendingContainerId(id);
    navigate({ to: "/containers" });
  };

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
      <ListPane
        title="Networks"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No networks"}
            description={q ? "Try another name or driver." : "Create a bridge network to isolate Compose stacks."}
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search networks" }}
        actions={
          <Tip label="Create a Docker network">
            <Button size="S" onPress={() => setCreateOpen(true)}>
              Create
            </Button>
          </Tip>
        }
      >
        {filtered.map((n) => (
          <RowMenu
            key={n.Id}
            active={selected === n.Id}
            onSelect={() => setSelected(n.Id)}
            items={[
              { id: "open", label: "Open", onAction: () => setSelected(n.Id) },
              { id: "copy-id", label: "Copy ID", onAction: () => void copyText(n.Id) },
              { id: "copy-name", label: "Copy name", onAction: () => void copyText(n.Name) },
              { id: "sep-1", label: "", onAction: () => {} },
              {
                id: "remove",
                label: "Remove…",
                onAction: () => {
                  setSelected(n.Id);
                  setConfirmRemove(true);
                },
                destructive: true,
              },
            ]}
            suffix={<StatusBadge tone={driverTone(n.Driver)}>{n.Driver || "—"}</StatusBadge>}
          >
            <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
              {n.Name}
            </div>
            <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, minWidth: 0 })}>
              {n.Scope || "local"}
              {n.Id ? ` · ${shortId(n.Id)}` : ""}
            </div>
          </RowMenu>
        ))}
      </ListPane>

      <DetailPane
        selectionKey={selected}
        empty={
          <DetailEmpty
            title="Select a network"
            description="Inspect subnet, gateway, and attached containers — or create a new network."
            action={
              <Button size="S" variant="secondary" onPress={() => setCreateOpen(true)}>
                Create network
              </Button>
            }
          />
        }
      >
        {insp ? (
          <div className={style({ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 8 })}>
            <div
              className={style({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "start",
                justifyContent: "space-between",
                gap: 12,
              })}
            >
              <div className={style({ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column", gap: 8 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" })}>
                  <DetailHeading>{insp.Name || row?.Name}</DetailHeading>
                  <StatusBadge tone={driverTone(insp.Driver)}>{insp.Driver || "—"}</StatusBadge>
                </div>
                <div className={style({ font: "code-xs", color: "neutral-subdued" })}>
                  {shortId(insp.Id || selected || "")}
                  {insp.Scope ? ` · ${insp.Scope}` : ""}
                </div>
              </div>
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                <CopyButton value={insp.Id || selected || ""} label="Copy ID" />
                <Button size="S" variant="negative" onPress={() => setConfirmRemove(true)}>
                  Remove
                </Button>
              </div>
            </div>

            <InspectFields
              rows={[
                { label: "Subnet", value: ipam?.Subnet, mono: true },
                { label: "Gateway", value: ipam?.Gateway, mono: true },
                { label: "IP range", value: ipam?.IPRange, mono: true },
                {
                  label: "Internal",
                  value: insp.Internal != null ? (insp.Internal ? "yes" : "no") : undefined,
                },
                {
                  label: "Attachable",
                  value: insp.Attachable != null ? (insp.Attachable ? "yes" : "no") : undefined,
                },
                { label: "Created", value: insp.Created },
              ]}
            />

            <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
              <div className={style({ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 })}>
                <div className={style({ font: "title-sm" })}>Attached containers</div>
                <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                  {detail.isLoading ? "Loading…" : `${attached.length}`}
                </div>
              </div>
              {attached.length === 0 && !detail.isLoading ? (
                <div className={style({ font: "body-sm", color: "neutral-subdued" })}>
                  Nothing attached. Point a container or Compose service at this network to see it here.
                </div>
              ) : (
                <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
                  {attached.map(([id, c]) => (
                    <button
                      key={id}
                      type="button"
                      className={style({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        paddingX: 12,
                        paddingY: 8,
                        borderRadius: "lg",
                        borderWidth: 0,
                        textAlign: "start",
                        cursor: "pointer",
                        backgroundColor: "gray-100",
                        color: "neutral",
                      })}
                      onClick={() => openContainer(id)}
                    >
                      <span className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                        {c.Name || shortId(id)}
                      </span>
                      <span className={style({ font: "code-xs", color: "neutral-subdued", flexShrink: 0 })}>
                        {c.IPv4Address || c.IPv6Address || shortId(id)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {Object.keys(insp.Labels || {}).length ? (
              <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Labels</div>
                <LabelChips labels={insp.Labels} />
              </div>
            ) : null}

            <div>
              <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide JSON" : "Inspect JSON"}
              </Button>
            </div>
            {showRaw ? (
              <CodeBlock
                title="Inspect"
                meta="network"
                value={JSON.stringify(detail.data || insp, null, 2)}
              />
            ) : null}
          </div>
        ) : null}
      </DetailPane>

      <GlassSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create network"
        description="Isolates containers — bridge for local stacks, overlay for Swarm."
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" isDisabled={!name.trim() || creating} isPending={creating} onPress={() => void createNetwork()}>
              Create
            </Button>
          </>
        }
      >
        <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
          <Field value={name} onChange={setName} placeholder="my-network" aria-label="Network name" />
          <Picker
            label="Driver"
            selectedKey={driver}
            onSelectionChange={(k) => {
              if (k) setDriver(String(k));
            }}
          >
            <PickerItem id="bridge">bridge</PickerItem>
            <PickerItem id="overlay">overlay</PickerItem>
            <PickerItem id="macvlan">macvlan</PickerItem>
            <PickerItem id="ipvlan">ipvlan</PickerItem>
            <PickerItem id="host">host</PickerItem>
            <PickerItem id="none">none</PickerItem>
          </Picker>
        </div>
      </GlassSheet>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove network"
        description={`Remove network “${insp?.Name || row?.Name}”? Containers must be disconnected first.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!selected) return;
          try {
            await api.removeNetwork(selected);
            toast.success("Network removed");
            setSelected(null);
            qc.invalidateQueries({ queryKey: ["networks"] });
          } catch (e: any) {
            toast.error("Remove failed", { description: e?.message });
          }
        }}
      />
    </div>
  );
}
