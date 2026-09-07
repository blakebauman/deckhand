import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api, type SystemPruneBody } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HelpHint } from "@/components/HelpHint";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

type PruneResourceKey = keyof Pick<SystemPruneBody, "images" | "containers" | "volumes" | "buildCache">;

const rows: {
  key: keyof Pick<
    Awaited<ReturnType<typeof api.systemDf>>,
    "imagesSize" | "containersSize" | "volumesSize" | "buildCacheSize"
  >;
  label: string;
  total: "imagesTotal" | "containersTotal" | "volumesTotal" | "buildCacheTotal";
  active: "imagesActive" | "containersActive" | "volumesActive" | "buildCacheActive";
  pruneKey: PruneResourceKey;
  tip: string;
}[] = [
  {
    key: "imagesSize",
    label: "Images",
    total: "imagesTotal",
    active: "imagesActive",
    pruneKey: "images",
    tip: "Local image layers (dangling images are reclaimable)",
  },
  {
    key: "containersSize",
    label: "Containers",
    total: "containersTotal",
    active: "containersActive",
    pruneKey: "containers",
    tip: "Writable layer size for stopped containers is reclaimable",
  },
  {
    key: "volumesSize",
    label: "Volumes",
    total: "volumesTotal",
    active: "volumesActive",
    pruneKey: "volumes",
    tip: "Unused named volumes (destructive — data is deleted)",
  },
  {
    key: "buildCacheSize",
    label: "Build cache",
    total: "buildCacheTotal",
    active: "buildCacheActive",
    pruneKey: "buildCache",
    tip: "BuildKit cache not currently in use",
  },
];

const defaultSelected: SystemPruneBody = {
  containers: true,
  images: true,
  volumes: false,
  networks: true,
  buildCache: true,
};

export function DiskUsagePanel({
  compact,
  hideTitle,
}: {
  compact?: boolean;
  /** When true, omit the built-in title (parent card already labels it). */
  hideTitle?: boolean;
}) {
  const qc = useQueryClient();
  const confirmPrune = useUIStore((s) => s.confirmPrune);
  const df = useQuery({ queryKey: ["system-df"], queryFn: api.systemDf, refetchInterval: 20000 });
  const [selected, setSelected] = useState<SystemPruneBody>(defaultSelected);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  const data = df.data;
  const max = Math.max(
    data?.imagesSize || 0,
    data?.containersSize || 0,
    data?.volumesSize || 0,
    data?.buildCacheSize || 0,
    1,
  );
  const reclaimable = data?.reclaimable || 0;
  const selectedCount = rows.filter((r) => selected[r.pruneKey]).length + (selected.networks ? 1 : 0);

  const runPrune = async () => {
    setPruning(true);
    setResult(null);
    try {
      const res = await api.systemPrune(selected);
      const summary =
        `Reclaimed ${formatBytes(res.spaceReclaimed)} · ` +
        [
          res.containersDeleted && `${res.containersDeleted} containers`,
          res.imagesDeleted && `${res.imagesDeleted} images`,
          res.volumesDeleted && `${res.volumesDeleted} volumes`,
          res.networksDeleted && `${res.networksDeleted} networks`,
          res.buildCachesDeleted && `${res.buildCachesDeleted} cache entries`,
        ]
          .filter(Boolean)
          .join(", ");
      setResult(summary);
      toast.success("Prune complete", { description: summary });
      qc.invalidateQueries({ queryKey: ["system-df"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["images"] });
      qc.invalidateQueries({ queryKey: ["volumes"] });
      qc.invalidateQueries({ queryKey: ["networks"] });
      qc.invalidateQueries({ queryKey: ["docker-dashboard"] });
    } catch (e: any) {
      const msg = e.message || "Prune failed";
      setResult(msg);
      toast.error("Prune failed", { description: msg });
    } finally {
      setPruning(false);
    }
  };

  const requestPrune = () => {
    if (confirmPrune) setConfirm(true);
    else void runPrune();
  };

  if (df.isLoading && !data) {
    return (
      <div
        className={
          compact
            ? "flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 text-center"
            : "flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 text-center"
        }
      >
        <Loader2 aria-label="Measuring disk usage" className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Measuring disk usage…</span>
        <span className="text-xs text-muted-foreground">docker system df can take a while on large engines</span>
      </div>
    );
  }

  if (df.isError) {
    return (
      <div
        className={
          compact
            ? "flex min-h-[180px] flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center"
            : "flex min-h-[140px] flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center"
        }
      >
        <span className="text-sm font-semibold">Disk usage unavailable</span>
        <span className="text-sm text-muted-foreground">Is the Docker engine running?</span>
      </div>
    );
  }

  return (
    <div className={compact ? "flex min-h-0 flex-1 flex-col gap-2.5" : "flex min-h-0 flex-1 flex-col gap-3.5"}>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {!hideTitle ? (
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Engine disk</span>
              <HelpHint label="From docker system df — reclaimable is unused layers, stopped containers, and idle cache" />
            </div>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xl font-semibold tracking-tight tabular-nums">
              {formatBytes(reclaimable)}
            </span>
            <span className="text-sm text-muted-foreground">reclaimable</span>
          </div>
        </div>
        {!compact ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={requestPrune}
            disabled={pruning || selectedCount === 0}
          >
            Prune selected…
          </Button>
        ) : null}
      </div>

      <div className={compact ? "flex min-h-0 flex-1 flex-col gap-2" : "flex min-h-0 flex-1 flex-col gap-2.5"}>
        {rows.map((row) => {
          const size = data?.[row.key] || 0;
          const active = data?.[row.active] ?? 0;
          const total = data?.[row.total] ?? 0;
          const pct = Math.round((size / max) * 100);
          const id = `prune-${row.pruneKey}`;
          return (
            <div key={row.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={!!selected[row.pruneKey]}
                    onCheckedChange={(next) =>
                      setSelected((s) => ({ ...s, [row.pruneKey]: !!next }))
                    }
                  />
                  <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
                    {row.label}
                  </Label>
                  <HelpHint label={row.tip} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-medium tabular-nums">{formatBytes(size)}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {active}/{total} in use
                  </span>
                </div>
              </div>
              <Progress value={pct} aria-label={`${row.label} size`} className="gap-0 [&>[data-slot=progress-track]]:h-1.5" />
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="prune-networks"
            checked={selected.networks}
            onCheckedChange={(networks) => setSelected((s) => ({ ...s, networks: !!networks }))}
          />
          <Label htmlFor="prune-networks" className="cursor-pointer text-sm font-medium">
            Unused networks
          </Label>
        </div>
        {compact ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={requestPrune}
            disabled={pruning || selectedCount === 0}
          >
            Prune…
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
        )}
      </div>

      {result ? <span className="text-xs text-muted-foreground">{result}</span> : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Prune Docker resources"
        description={
          selected.volumes
            ? "This removes unused containers, images, networks, and unused volumes. Volume data cannot be recovered."
            : "Remove unused resources selected above. Image and container data that is still referenced will be kept."
        }
        confirmLabel={pruning ? "Pruning…" : "Prune"}
        destructive
        loading={pruning}
        onConfirm={runPrune}
      />
    </div>
  );
}
