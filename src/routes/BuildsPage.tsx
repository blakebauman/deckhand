import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Field } from "@/components/Field";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { useDockerReconnect } from "@/hooks/useDockerReconnect";
import { api } from "@/lib/api";
import { useUIStore } from "@/stores/uiStore";

export function BuildsPage() {
  const qc = useQueryClient();
  const openRunSheet = useUIStore((s) => s.openRunSheet);
  const { reconnect } = useDockerReconnect();

  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const builders = useQuery({
    queryKey: ["builders"],
    queryFn: api.builders,
    retry: false,
    enabled: !!status.data?.docker.connected,
  });

  const [context, setContext] = useState(".");
  const [dockerfile, setDockerfile] = useState("Dockerfile");
  const [tag, setTag] = useState("");
  const [buildLog, setBuildLog] = useState("");
  const [building, setBuilding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof api.registrySearch>>>([]);
  const [pulling, setPulling] = useState<string | null>(null);
  const [pullLog, setPullLog] = useState("");
  const [pullSheetOpen, setPullSheetOpen] = useState(false);

  const dockerOk = !!status.data?.docker.connected;

  const runBuild = async () => {
    setBuilding(true);
    setBuildLog("");
    setSheetOpen(true);
    try {
      await api.buildImage(
        {
          context: context.trim(),
          dockerfile: dockerfile.trim() || undefined,
          tag: tag.trim() || undefined,
        },
        (chunk) => setBuildLog((prev) => (prev + chunk).slice(-200_000)),
      );
      setBuildLog((p) => p + "\nBuild complete.\n");
      await qc.invalidateQueries({ queryKey: ["images"] });
      toast.success("Build finished", { description: tag.trim() || context.trim() });
    } catch (e: any) {
      setBuildLog((p) => p + `\n${e?.message || "build failed"}\n`);
      toast.error("Build failed", { description: e?.message });
    } finally {
      setBuilding(false);
    }
  };

  const runSearch = async () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    try {
      const rows = await api.registrySearch(q);
      setResults(rows);
    } catch (e: any) {
      toast.error("Registry search failed", { description: e?.message });
    } finally {
      setSearching(false);
    }
  };

  const pullRef = async (ref: string) => {
    setPulling(ref);
    setPullLog("");
    setPullSheetOpen(true);
    try {
      await api.pullImageStream(ref, (chunk) => {
        setPullLog((prev) => (prev + chunk).slice(-200_000));
      });
      setPullLog((p) => p + "\nPull complete.\n");
      await qc.invalidateQueries({ queryKey: ["images"] });
      toast.success("Pulled", { description: ref });
    } catch (e: any) {
      setPullLog((p) => p + `\n${e?.message || "pull failed"}\n`);
      toast.error("Pull failed", { description: e?.message });
    } finally {
      setPulling(null);
    }
  };

  const builderList = builders.data || [];

  return (
    <PageShell title="Builds" description="Build images, list builders, and search Docker Hub.">
      {!dockerOk && status.isSuccess ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
          <div className="min-w-0">
            <span className="text-sm font-medium">Docker is offline</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {status.data?.docker.error || "Attach an engine to build or search."}
            </span>
          </div>
          <Button size="sm" onClick={() => void reconnect()}>
            Retry connection
          </Button>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-5">
        <section className="flex min-w-0 flex-col gap-2.5">
          <span className="text-sm font-semibold">Builders</span>
          {!dockerOk ? (
            <span className="text-sm text-muted-foreground">
              Connect Docker to list buildx builders.
            </span>
          ) : builders.isLoading ? (
            <span className="text-sm text-muted-foreground">Loading builders…</span>
          ) : builderList.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No builders — docker buildx ls returned nothing.
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {builderList.map((b) => (
                <div
                  key={b.name}
                  className="inline-flex min-w-0 items-center gap-2 rounded-lg bg-muted px-3 py-2"
                >
                  <span className="truncate text-sm font-medium">{b.name}</span>
                  {b.driver ? <StatusBadge tone="muted">{b.driver}</StatusBadge> : null}
                  {b.status ? (
                    <StatusBadge tone={b.status === "running" ? "success" : "muted"}>
                      {b.status}
                    </StatusBadge>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-3">
            <span className="text-sm font-semibold">Build image</span>
            <Field
              value={context}
              onChange={setContext}
              placeholder="context path"
              aria-label="Context path"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                value={dockerfile}
                onChange={setDockerfile}
                placeholder="Dockerfile"
                aria-label="Dockerfile"
              />
              <Field
                value={tag}
                onChange={setTag}
                placeholder="tag (optional)"
                aria-label="Image tag"
              />
            </div>
            <div>
              <Button
                onClick={() => void runBuild()}
                disabled={building || !context.trim() || !dockerOk}
              >
                {building ? "Building…" : "Build"}
              </Button>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <span className="text-sm font-semibold">Registry search</span>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field
                  value={searchQ}
                  onChange={setSearchQ}
                  placeholder="Search Docker Hub"
                  aria-label="Registry search"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runSearch();
                  }}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => void runSearch()}
                disabled={searching || !searchQ.trim() || !dockerOk}
              >
                Search
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {results.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  Search Hub for public images, then pull.
                </span>
              ) : (
                results.map((r) => (
                  <div
                    key={r.name}
                    className="flex min-w-0 items-center gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.name}</span>
                        {r.isOfficial ? <StatusBadge tone="accent">official</StatusBadge> : null}
                        <span className="text-xs text-muted-foreground">★ {r.starCount}</span>
                      </div>
                      {r.description ? (
                        <div
                          className="mt-0.5 truncate text-xs text-muted-foreground"
                          title={r.description}
                        >
                          {r.description}
                        </div>
                      ) : null}
                    </div>
                    <Tip label={`Pull ${r.name}`}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void pullRef(r.name)}
                        disabled={pulling === r.name || !dockerOk}
                      >
                        Pull
                      </Button>
                    </Tip>
                    <Tip label="Run after pull">
                      <Button size="sm" variant="secondary" onClick={() => openRunSheet(r.name)}>
                        Run
                      </Button>
                    </Tip>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={building ? "Building…" : "Build output"}
        description={tag.trim() || context.trim()}
        mono
        footer={
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={buildLog}>{buildLog || "Waiting for buildkit…"}</TerminalBlock>
      </GlassSheet>

      <GlassSheet
        open={pullSheetOpen}
        onOpenChange={setPullSheetOpen}
        title={pulling ? `Pulling ${pulling}` : "Pull output"}
        description="Live progress from the Docker engine"
        mono
        footer={
          <Button variant="secondary" onClick={() => setPullSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={pullLog}>{pullLog || "Waiting for layers…"}</TerminalBlock>
      </GlassSheet>
    </PageShell>
  );
}
