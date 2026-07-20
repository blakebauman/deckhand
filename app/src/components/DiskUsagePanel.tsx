import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ProgressBar, Switch, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, type SystemPruneBody } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HelpHint } from "@/components/HelpHint";
import { toast } from "@/components/Toaster";
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

export function DiskUsagePanel({ compact }: { compact?: boolean }) {
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
    return <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>Measuring disk usage…</Text>;
  }

  if (df.isError) {
    return (
      <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
        Disk usage unavailable — is Docker running?
      </Text>
    );
  }

  return (
    <div
      className={
        compact
          ? style({
              display: "flex",
              flexDirection: "column",
              gap: 12,
            })
          : style({
              display: "flex",
              flexDirection: "column",
              gap: 16,
            })
      }
    >
      <div
        className={style({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 8,
        })}
      >
        <div>
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
            <Text
              styles={style({
                font: "detail",
                fontWeight: "medium",
                color: "neutral-subdued",
              })}
            >
              Engine disk
            </Text>
            <HelpHint label="From docker system df — reclaimable is unused layers, stopped containers, and idle cache" />
          </div>
          <div className={style({ marginTop: 4, display: "flex", alignItems: "baseline", gap: 8 })}>
            <Text styles={style({ font: "heading-lg", fontWeight: "bold" })}>
              {formatBytes(data?.reclaimable || 0)}
            </Text>
            <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>reclaimable</Text>
          </div>
        </div>
        {!compact ? (
          <Button variant="secondary" size="S" onPress={requestPrune} isDisabled={pruning} isPending={pruning}>
            Prune selected…
          </Button>
        ) : null}
      </div>

      <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
        {rows.map((row) => {
          const size = data?.[row.key] || 0;
          return (
            <div key={row.key}>
              <div
                className={style({
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                })}
              >
                <div className={style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })}>
                  <Switch
                    isSelected={!!selected[row.pruneKey]}
                    onChange={(next) => setSelected((s) => ({ ...s, [row.pruneKey]: next }))}
                  >
                    {row.label}
                  </Switch>
                  <HelpHint label={row.tip} />
                </div>
                <Text styles={style({ font: "body-xs", color: "neutral-subdued", flexShrink: 0 })}>
                  {formatBytes(size)} · {data?.[row.active] ?? 0}/{data?.[row.total] ?? 0} in use
                </Text>
              </div>
              <ProgressBar aria-label={`${row.label} size`} value={size} maxValue={max} size="S" />
            </div>
          );
        })}
      </div>

      <Switch
        isSelected={selected.networks}
        onChange={(networks) => setSelected((s) => ({ ...s, networks }))}
      >
        Also prune unused networks
      </Switch>

      {compact ? (
        <Button variant="secondary" size="S" onPress={requestPrune} isDisabled={pruning} isPending={pruning}>
          Prune selected…
        </Button>
      ) : null}

      {result ? (
        <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>{result}</Text>
      ) : null}

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
