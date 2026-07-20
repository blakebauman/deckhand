import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  Divider,
  Picker,
  PickerItem,
  Switch,
  Text,
  TextArea,
  TextField,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, type MountSpec, type RunContainerBody } from "@/lib/api";
import { GlassSheet } from "@/components/GlassSheet";
import { HelpHint } from "@/components/HelpHint";
import { toast } from "@/components/Toaster";
import { useUIStore } from "@/stores/uiStore";

const emptyForm = {
  image: "nginx:alpine",
  name: "",
  cmd: "",
  ports: "8080:80",
  env: "",
  mounts: "",
  labels: "",
  network: "",
  workdir: "",
  restart: "no" as RunContainerBody["restart"],
  gpu: false,
  autoRemove: false,
  start: true,
};

/** Parse lines like `key=value` into a label map. */
function parseLabelLines(text: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) {
      throw new Error(`Invalid label (need key=value): ${line}`);
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) {
      throw new Error(`Invalid label (need key=value): ${line}`);
    }
    labels[key] = value;
  }
  return labels;
}

/** Parse lines like `/host:/container:ro` or `volname:/path` into MountSpec[]. */
function parseMountLines(text: string): MountSpec[] {
  const mounts: MountSpec[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let readOnly = false;
    let rest = line;
    if (rest.endsWith(":ro") || rest.endsWith(":rw")) {
      readOnly = rest.endsWith(":ro");
      rest = rest.slice(0, -3);
    }
    const colon = rest.lastIndexOf(":");
    if (colon <= 0) {
      throw new Error(`Invalid mount (need source:target): ${line}`);
    }
    const source = rest.slice(0, colon).trim();
    const target = rest.slice(colon + 1).trim();
    if (!source || !target) {
      throw new Error(`Invalid mount (need source:target): ${line}`);
    }
    mounts.push({ source, target, readOnly: readOnly || undefined });
  }
  return mounts;
}

export function RunContainerSheet({
  open,
  onOpenChange,
  initialImage,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialImage?: string;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const startAfterCreate = useUIStore((s) => s.startAfterCreate);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm((f) => ({
      ...emptyForm,
      start: startAfterCreate,
      image: initialImage || f.image || emptyForm.image,
    }));
  }, [open, initialImage, startAfterCreate]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const ports = form.ports
        .split(/[\n,]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const env = form.env
        .split("\n")
        .map((e) => e.trim())
        .filter(Boolean);
      const mounts = parseMountLines(form.mounts);
      const labels = parseLabelLines(form.labels);
      const body: RunContainerBody = {
        image: form.image.trim(),
        name: form.name.trim() || undefined,
        cmd: form.cmd.trim() || undefined,
        ports,
        env,
        mounts: mounts.length ? mounts : undefined,
        labels: Object.keys(labels).length ? labels : undefined,
        network: form.network.trim() || undefined,
        workdir: form.workdir.trim() || undefined,
        restart: form.restart || "no",
        gpu: form.gpu,
        autoRemove: form.autoRemove,
        start: form.start,
      };
      const res = await api.createContainer(body);
      await qc.invalidateQueries({ queryKey: ["containers"] });
      await qc.invalidateQueries({ queryKey: ["docker-dashboard"] });
      toast.success(form.start ? "Container started" : "Container created", {
        description: form.name.trim() || res.id.slice(0, 12),
      });
      onOpenChange(false);
      onCreated?.(res.id);
    } catch (e: any) {
      const msg = e.message || "Failed to create container";
      setError(msg);
      toast.error("Run failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Run container"
      description="Create from an image — like docker run, with optional GPU and ports."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onPress={() => onOpenChange(false)} isDisabled={busy}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onPress={() => void submit()}
            isDisabled={busy || !form.image.trim()}
            isPending={busy}
          >
            {form.start ? "Run" : "Create"}
          </Button>
        </>
      }
    >
      <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
        <TextField
          label="Image"
          contextualHelp={<HelpHint label="Registry reference, e.g. nginx:alpine or ghcr.io/org/app:tag" />}
          value={form.image}
          onChange={(image) => setForm({ ...form, image })}
          placeholder="image:tag"
          autoFocus
        />
        <div
          className={style({
            display: "grid",
            gridTemplateColumns: {
              default: "1fr",
              sm: "1fr 1fr",
            },
            gap: 16,
          })}
        >
          <TextField
            label="Name"
            contextualHelp={<HelpHint label="Optional container name" />}
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            placeholder="my-app"
          />
          <TextField
            label="Ports"
            contextualHelp={<HelpHint label="host:container, comma or newline separated (e.g. 8080:80)" />}
            value={form.ports}
            onChange={(ports) => setForm({ ...form, ports })}
            placeholder="8080:80"
          />
        </div>
        <TextField
          label="Command"
          contextualHelp={<HelpHint label="Passed to sh -c inside the container" />}
          value={form.cmd}
          onChange={(cmd) => setForm({ ...form, cmd })}
          placeholder="optional override"
        />
        <TextArea
          label="Environment"
          contextualHelp={<HelpHint label="One KEY=value per line" />}
          value={form.env}
          onChange={(env) => setForm({ ...form, env })}
          placeholder={"FOO=bar\nBAR=baz"}
        />
        <TextArea
          label="Mounts"
          contextualHelp={
            <HelpHint label="One per line: /host:/container:ro or volname:/path (optional :ro / :rw)" />
          }
          value={form.mounts}
          onChange={(mounts) => setForm({ ...form, mounts })}
          placeholder={"/data:/app/data:ro\nmyvol:/var/lib/app"}
        />
        <TextArea
          label="Labels"
          contextualHelp={
            <HelpHint label="One key=value per line. Domains: dev.deckhand.domains=api.local (optional dev.deckhand.http-port=80)" />
          }
          value={form.labels}
          onChange={(labels) => setForm({ ...form, labels })}
          placeholder={"dev.deckhand.domains=myapp.local"}
        />
        <div
          className={style({
            display: "grid",
            gridTemplateColumns: {
              default: "1fr",
              sm: "1fr 1fr 1fr",
            },
            gap: 16,
          })}
        >
          <TextField
            label="Network"
            contextualHelp={<HelpHint label="Attach to an existing Docker network" />}
            value={form.network}
            onChange={(network) => setForm({ ...form, network })}
            placeholder="bridge"
          />
          <TextField
            label="Working directory"
            contextualHelp={<HelpHint label="Container working directory (WORKDIR)" />}
            value={form.workdir}
            onChange={(workdir) => setForm({ ...form, workdir })}
            placeholder="/app"
          />
          <Picker
            label="Restart policy"
            value={form.restart || "no"}
            onChange={(v) => setForm({ ...form, restart: v as RunContainerBody["restart"] })}
          >
            <PickerItem id="no">no</PickerItem>
            <PickerItem id="always">always</PickerItem>
            <PickerItem id="unless-stopped">unless-stopped</PickerItem>
            <PickerItem id="on-failure">on-failure</PickerItem>
          </Picker>
        </div>

        <div
          className={style({
            backgroundColor: "layer-2",
            borderRadius: "xl",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          })}
        >
          <div
            className={style({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            })}
          >
            <div>
              <Text styles={style({ font: "ui", fontWeight: "medium" })}>Start after create</Text>
              <p
                className={style({
                  margin: 0,
                  marginTop: 2,
                  font: "body-xs",
                  color: "neutral-subdued",
                })}
              >
                Run immediately, or create in exited state
              </p>
            </div>
            <Switch
              aria-label="Start after create"
              isSelected={form.start}
              onChange={(start) => setForm({ ...form, start })}
            />
          </div>
          <Divider size="S" />
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
            <Checkbox isSelected={form.gpu} onChange={(gpu) => setForm({ ...form, gpu })}>
              Request GPU
            </Checkbox>
            <HelpHint label="Adds an NVIDIA DeviceRequest (docker run --gpus all)" />
          </div>
          <Checkbox
            isSelected={form.autoRemove}
            onChange={(autoRemove) => setForm({ ...form, autoRemove })}
            description="Delete the container when it exits (--rm)"
          >
            Auto-remove
          </Checkbox>
        </div>

        {error ? (
          <Text styles={style({ font: "body-sm", color: "negative" })}>{error}</Text>
        ) : null}
      </div>
    </GlassSheet>
  );
}
