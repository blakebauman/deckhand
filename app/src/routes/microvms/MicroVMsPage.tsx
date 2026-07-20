import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { PageShell } from "@/components/PageShell";
import { Field } from "@/components/spectrum/Field";

export function MicroVMsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["vms"], queryFn: api.listVMs, refetchInterval: 5000 });
  const [form, setForm] = useState({ name: "", kernel: "", rootfs: "", vcpu: 1, memoryMb: 512 });
  const [logs, setLogs] = useState("");

  return (
    <PageShell title="VMs" description="Create, start, stop, and inspect Firecracker microVMs.">
      <div className={style({ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 })}>
        <Field placeholder="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field placeholder="kernel path" value={form.kernel} onChange={(v) => setForm({ ...form, kernel: v })} />
        <Field placeholder="rootfs path" value={form.rootfs} onChange={(v) => setForm({ ...form, rootfs: v })} />
        <Button
          onPress={() =>
            api.createVM(form).then(() => {
              qc.invalidateQueries({ queryKey: ["vms"] });
            })
          }
        >
          Create
        </Button>
      </div>
      <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
        {(list.data || []).map((vm) => (
          <div key={vm.id} className={style({ backgroundColor: "layer-1", borderRadius: "xl", paddingX: 16, paddingY: 16 })}>
            <div
              className={style({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              })}
            >
              <div className={style({ minWidth: 0, flexGrow: 1 })}>
                <div className={style({ fontWeight: "medium", truncate: true })}>{vm.name}</div>
                <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                  {vm.state} · {vm.vcpu} vCPU · {vm.memoryMb} MB
                </div>
              </div>
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 })}>
                <Button size="S" onPress={() => api.startVM(vm.id).then(() => qc.invalidateQueries({ queryKey: ["vms"] }))}>
                  Start
                </Button>
                <Button
                  size="S"
                  variant="secondary"
                  onPress={() => api.stopVM(vm.id).then(() => qc.invalidateQueries({ queryKey: ["vms"] }))}
                >
                  Stop
                </Button>
                <Button
                  size="S"
                  variant="secondary"
                  fillStyle="outline"
                  onPress={async () => {
                    const res = await api.vmLogs(vm.id);
                    setLogs(res.output);
                  }}
                >
                  Logs
                </Button>
                <Button
                  size="S"
                  variant="negative"
                  onPress={() => api.destroyVM(vm.id).then(() => qc.invalidateQueries({ queryKey: ["vms"] }))}
                >
                  Destroy
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {logs ? <pre className={style({ marginTop: 16, maxHeight: 256, overflow: "auto", borderRadius: "xl", padding: 16, font: "code-xs", backgroundColor: "layer-2" })}>{logs}</pre> : null}
    </PageShell>
  );
}
