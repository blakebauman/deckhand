import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type MountSpec, type RunContainerBody } from "@/lib/api";
import { GlassSheet } from "@/components/GlassSheet";
import { HelpHint } from "@/components/HelpHint";
import { toast } from "@/components/Toaster";
import { useUIStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";


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
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => void submit()}
            disabled={busy || !form.image.trim()}
          >
            {form.start ? "Run" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-image">Image</Label>
          <Input
            id="run-image"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            placeholder="image:tag"
          />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-name">Name</Label>
            <Input
              id="run-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my-app"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-ports">Ports</Label>
            <Input
              id="run-ports"
              value={form.ports}
              onChange={(e) => setForm({ ...form, ports: e.target.value })}
              placeholder="8080:80"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-cmd">Command</Label>
          <Input
            id="run-cmd"
            value={form.cmd}
            onChange={(e) => setForm({ ...form, cmd: e.target.value })}
            placeholder="optional override"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-env">Environment</Label>
          <Textarea
            id="run-env"
            value={form.env}
            onChange={(e) => setForm({ ...form, env: e.target.value })}
            placeholder={"FOO=bar\nBAR=baz"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-mounts">Mounts</Label>
          <Textarea
            id="run-mounts"
            value={form.mounts}
            onChange={(e) => setForm({ ...form, mounts: e.target.value })}
            placeholder={"/data:/app/data:ro\nmyvol:/var/lib/app"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="run-labels">Labels</Label>
          <Textarea
            id="run-labels"
            value={form.labels}
            onChange={(e) => setForm({ ...form, labels: e.target.value })}
            placeholder={"dev.deckhand.domains=myapp.local"}
          />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-network">Network</Label>
            <Input
              id="run-network"
              value={form.network}
              onChange={(e) => setForm({ ...form, network: e.target.value })}
              placeholder="bridge"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-workdir">Working directory</Label>
            <Input
              id="run-workdir"
              value={form.workdir}
              onChange={(e) => setForm({ ...form, workdir: e.target.value })}
              placeholder="/app"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="run-restart">Restart policy</Label>
            <Select
              value={form.restart || "no"}
              onValueChange={(v) =>
                setForm({ ...form, restart: (v || "no") as RunContainerBody["restart"] })
              }
            >
              <SelectTrigger id="run-restart" className="w-full">
                <SelectValue placeholder="Restart policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">no</SelectItem>
                <SelectItem value="always">always</SelectItem>
                <SelectItem value="unless-stopped">unless-stopped</SelectItem>
                <SelectItem value="on-failure">on-failure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-muted p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-medium">Start after create</span>
              <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                Run immediately, or create in exited state
              </p>
            </div>
            <Switch
              aria-label="Start after create"
              checked={form.start}
              onCheckedChange={(start) => setForm({ ...form, start })}
            />
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Checkbox
              id="run-gpu"
              checked={form.gpu}
              onCheckedChange={(gpu) => setForm({ ...form, gpu: !!gpu })}
            />
            <Label htmlFor="run-gpu" className="cursor-pointer text-sm font-medium">
              Request GPU
            </Label>
            <HelpHint label="Adds an NVIDIA DeviceRequest (docker run --gpus all)" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="run-rm"
              checked={form.autoRemove}
              onCheckedChange={(autoRemove) => setForm({ ...form, autoRemove: !!autoRemove })}
            />
            <Label htmlFor="run-rm" className="cursor-pointer text-sm font-medium">
              Auto-remove
            </Label>
            <HelpHint label="Delete the container when it exits (--rm)" />
          </div>
        </div>

        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </GlassSheet>
  );
}
