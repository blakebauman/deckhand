import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@react-spectrum/s2";
import { CommandPaletteHost } from "@/components/CommandPalette";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { GlassSheet } from "@/components/GlassSheet";
import { RunContainerSheet } from "@/components/RunContainerSheet";
import { useUIStore } from "@/stores/uiStore";

/** App-wide run/prune sheets + ⌘K palette. */
export function GlobalSheets() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const runOpen = useUIStore((s) => s.runSheetOpen);
  const runImage = useUIStore((s) => s.runSheetImage);
  const closeRun = useUIStore((s) => s.closeRunSheet);
  const openRun = useUIStore((s) => s.openRunSheet);
  const pruneOpen = useUIStore((s) => s.pruneSheetOpen);
  const closePrune = useUIStore((s) => s.closePruneSheet);
  const openPrune = useUIStore((s) => s.openPruneSheet);
  const setMode = useUIStore((s) => s.setMode);
  const setPendingContainerId = useUIStore((s) => s.setPendingContainerId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        void qc.invalidateQueries();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qc]);

  return (
    <>
      <CommandPaletteHost onRunContainer={() => openRun()} onOpenPrune={() => openPrune()} />
      <RunContainerSheet
        open={runOpen}
        onOpenChange={(o) => (o ? openRun(runImage) : closeRun())}
        initialImage={runImage}
        onCreated={(id) => {
          setPendingContainerId(id);
          setMode("docker");
          navigate({ to: "/containers" });
        }}
      />
      <GlassSheet
        open={pruneOpen}
        onOpenChange={(o) => (o ? openPrune() : closePrune())}
        title="Engine disk"
        description="Reclaim unused Docker storage"
        size="lg"
        footer={
          <Button variant="secondary" onPress={() => closePrune()}>
            Close
          </Button>
        }
      >
        <DiskUsagePanel />
      </GlassSheet>
    </>
  );
}
