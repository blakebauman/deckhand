import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { Field } from "@/components/Field";
import { GlassSheet } from "@/components/GlassSheet";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { shortId } from "@/lib/utils";
import { copyText } from "@/routes/shared";
import { useUIStore } from "@/stores/uiStore";

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
    <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
      <ListPane
        title="Networks"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No networks"}
            description={
              q
                ? "Try another name or driver."
                : "Create a bridge network to isolate Compose stacks."
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search networks" }}
        actions={
          <Tip label="Create a Docker network">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
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
            <div className="min-w-0 text-sm font-medium truncate">{n.Name}</div>
            <div className="min-w-0 text-muted-foreground text-xs truncate">
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
              <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
                Create network
              </Button>
            }
          />
        }
      >
        {insp ? (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DetailHeading>{insp.Name || row?.Name}</DetailHeading>
                  <StatusBadge tone={driverTone(insp.Driver)}>{insp.Driver || "—"}</StatusBadge>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {shortId(insp.Id || selected || "")}
                  {insp.Scope ? ` · ${insp.Scope}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={insp.Id || selected || ""} label="Copy ID" />
                <Button size="sm" variant="destructive" onClick={() => setConfirmRemove(true)}>
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

            <div className="flex flex-col gap-3">
              <div className="flex justify-between gap-2">
                <div className="text-sm font-semibold">Attached containers</div>
                <div className="text-muted-foreground text-xs">
                  {detail.isLoading ? "Loading…" : `${attached.length}`}
                </div>
              </div>
              {attached.length === 0 && !detail.isLoading ? (
                <div className="text-muted-foreground text-sm">
                  Nothing attached. Point a container or Compose service at this network to see it
                  here.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {attached.map(([id, c]) => (
                    <button
                      key={id}
                      type="button"
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-muted text-foreground rounded-lg border-0 cursor-pointer text-start"
                      onClick={() => openContainer(id)}
                    >
                      <span className="min-w-0 text-sm font-medium truncate">
                        {c.Name || shortId(id)}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {c.IPv4Address || c.IPv6Address || shortId(id)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {Object.keys(insp.Labels || {}).length ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs">Labels</div>
                <LabelChips labels={insp.Labels} />
              </div>
            ) : null}

            <div>
              <Button size="sm" variant="secondary" onClick={() => setShowRaw((v) => !v)}>
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
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!name.trim() || creating}
              onClick={() => void createNetwork()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            value={name}
            onChange={setName}
            placeholder="my-network"
            aria-label="Network name"
          />
          <Select value={driver} onValueChange={(k) => k && setDriver(k)}>
            <SelectTrigger aria-label="Driver" className="w-full">
              <SelectValue placeholder="Driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bridge">bridge</SelectItem>
              <SelectItem value="overlay">overlay</SelectItem>
              <SelectItem value="macvlan">macvlan</SelectItem>
              <SelectItem value="ipvlan">ipvlan</SelectItem>
              <SelectItem value="host">host</SelectItem>
              <SelectItem value="none">none</SelectItem>
            </SelectContent>
          </Select>
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
