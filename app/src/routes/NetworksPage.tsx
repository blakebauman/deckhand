import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, Picker, PickerItem } from "@react-spectrum/s2";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { shortId } from "@/lib/utils";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

import { copyText } from "@/routes/shared";

export function NetworksPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("bridge");
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
      (n) => n.Name?.toLowerCase().includes(needle) || n.Driver?.toLowerCase().includes(needle) || n.Id?.toLowerCase().includes(needle),
    );
  }, [list.data, q]);

  const row = filtered.find((n) => n.Id === selected);
  const insp = detail.data || row;
  const ipam = insp?.IPAM?.Config?.[0];
  const attached = Object.entries(insp?.Containers || {}) as [string, any][];

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
      <ListPane
        title="Networks"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No networks"}
            description={q ? "Try another name." : "Create a bridge network on the right."}
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search networks" }}
      >
        {filtered.map((n) => (
          <RowMenu
            key={n.Id}
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
          >
            <ListItem active={selected === n.Id} onClick={() => setSelected(n.Id)}>
              <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>{n.Name}</div>
              <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, marginTop: 2, minWidth: 0 })}>
                {n.Driver}
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
          empty={<DetailEmpty title="Select a network" description="Inspect a network, or create one below." />}
        >
          {insp ? (
            <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 })}>
              <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "start", justifyContent: "space-between", gap: 8 })}>
                <div className={style({ minWidth: 0, flexGrow: 1 })}>
                  <DetailHeading>{insp.Name || row?.Name}</DetailHeading>
                  <p className={style({ font: "code-xs", color: "neutral-subdued", marginTop: 4 })}>{shortId(insp.Id || selected || "")}</p>
                  <p className={style({ font: "body-sm", color: "neutral-subdued", marginTop: 4 })}>Driver · {insp.Driver || "—"}</p>
                </div>
                <CopyButton value={insp.Id || selected || ""} label="Copy ID" />
              </div>
              <InspectFields
                rows={[
                  { label: "Scope", value: insp.Scope },
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
              {attached.length ? (
                <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                    Attached ({attached.length})
                  </div>
                  <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                    {attached.map(([id, c]) => (
                      <div
                        key={id}
                        className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "layer-2", borderRadius: "lg", paddingX: 12, paddingY: 8, font: "body-sm" })}
                      >
                        <span className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                          {c.Name || shortId(id)}
                        </span>
                        <span className={style({ font: "code-xs", color: "neutral-subdued", flexShrink: 0 })}>
                          {c.IPv4Address || c.IPv6Address || shortId(id)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {Object.keys(insp.Labels || {}).length ? (
                <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Labels</div>
                  <LabelChips labels={insp.Labels} />
                </div>
              ) : null}
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setShowRaw((v) => !v)}>
                  {showRaw ? "Hide JSON" : "Inspect JSON"}
                </Button>
                <Button size="S" variant="negative" onPress={() => setConfirmRemove(true)}>
                  Remove
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
          <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Create network</div>
          <div className={style({ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" })}>
            <Field value={name} onChange={setName} placeholder="network name" />
            <Picker
              aria-label="Driver"
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
            <Button
              isDisabled={!name.trim()}
              onPress={() =>
                api
                  .createNetwork(name.trim(), driver)
                  .then((res) => {
                    setSelected(res.Id);
                    setName("");
                    qc.invalidateQueries({ queryKey: ["networks"] });
                    toast.success("Network created", { description: `${name} (${driver})` });
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
        title="Remove network"
        description={`Remove network “${insp?.Name || row?.Name}”?`}
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
