import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { PageShell } from "@/components/PageShell";
import { Field } from "@/components/spectrum/Field";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { toast } from "@/components/Toaster";
import { useUIStore } from "@/stores/uiStore";

export function BuildsPage() {
  const qc = useQueryClient();
  const openRunSheet = useUIStore((s) => s.openRunSheet);

  const builders = useQuery({ queryKey: ["builders"], queryFn: api.builders, retry: false });

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
    try {
      await api.pullImageStream(ref, () => {});
      await qc.invalidateQueries({ queryKey: ["images"] });
      toast.success("Pulled", { description: ref });
    } catch (e: any) {
      toast.error("Pull failed", { description: e?.message });
    } finally {
      setPulling(null);
    }
  };

  const builderList = builders.data || [];

  return (
    <PageShell title="Builds" description="Build images, list builders, and search Docker Hub.">
      <div className={style({ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 })}>
        <section className={style({ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 })}>
          <Text styles={style({ font: "title-sm", margin: 0 })}>Builders</Text>
          {builders.isLoading ? (
            <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>Loading builders…</Text>
          ) : builderList.length === 0 ? (
            <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
              No builders — docker buildx ls returned nothing, or the engine is offline.
            </Text>
          ) : (
            <div
              className={style({
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              })}
            >
              {builderList.map((b) => (
                <div
                  key={b.name}
                  className={style({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    paddingX: 12,
                    paddingY: 8,
                    borderRadius: "lg",
                    backgroundColor: "gray-100",
                    minWidth: 0,
                  })}
                >
                  <span className={style({ font: "body", fontWeight: "medium", truncate: true })}>
                    {b.name}
                  </span>
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

        <div
          className={style({
            display: "grid",
            gridTemplateColumns: {
              default: "1fr",
              md: "1fr 1fr",
            },
            gap: 32,
            alignItems: "start",
            minWidth: 0,
          })}
        >
          <section className={style({ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 })}>
            <Text styles={style({ font: "title-sm", margin: 0 })}>Build image</Text>
            <Field value={context} onChange={setContext} placeholder="context path" aria-label="Context path" />
            <div
              className={style({
                display: "grid",
                gridTemplateColumns: {
                  default: "1fr",
                  sm: "1fr 1fr",
                },
                gap: 12,
              })}
            >
              <Field
                value={dockerfile}
                onChange={setDockerfile}
                placeholder="Dockerfile"
                aria-label="Dockerfile"
              />
              <Field value={tag} onChange={setTag} placeholder="tag (optional)" aria-label="Image tag" />
            </div>
            <div>
              <Button
                onPress={() => void runBuild()}
                isDisabled={building || !context.trim()}
                isPending={building}
              >
                {building ? "Building…" : "Build"}
              </Button>
            </div>
          </section>

          <section className={style({ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 })}>
            <Text styles={style({ font: "title-sm", margin: 0 })}>Registry search</Text>
            <div className={style({ display: "flex", gap: 8, alignItems: "end" })}>
              <Field
                value={searchQ}
                onChange={setSearchQ}
                placeholder="Search Docker Hub"
                aria-label="Registry search"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <Button
                variant="secondary"
                onPress={() => void runSearch()}
                isDisabled={searching || !searchQ.trim()}
                isPending={searching}
              >
                Search
              </Button>
            </div>
            <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
              {results.length === 0 ? (
                <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
                  Search Hub for public images, then pull.
                </Text>
              ) : (
                results.map((r) => (
                  <div
                    key={r.name}
                    className={style({
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      paddingY: 8,
                      borderBottomWidth: 1,
                      borderStyle: "solid",
                      borderColor: "gray-200",
                    })}
                  >
                    <div className={style({ flexGrow: 1, minWidth: 0 })}>
                      <div
                        className={style({
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 8,
                        })}
                      >
                        <span className={style({ font: "body", fontWeight: "medium", truncate: true })}>
                          {r.name}
                        </span>
                        {r.isOfficial ? <StatusBadge tone="accent">official</StatusBadge> : null}
                        <span className={style({ font: "body-xs", color: "neutral-subdued" })}>
                          ★ {r.starCount}
                        </span>
                      </div>
                      {r.description ? (
                        <div
                          className={style({
                            font: "body-xs",
                            color: "neutral-subdued",
                            marginTop: 2,
                            truncate: true,
                          })}
                          title={r.description}
                        >
                          {r.description}
                        </div>
                      ) : null}
                    </div>
                    <Tip label={`Pull ${r.name}`}>
                      <Button
                        size="S"
                        variant="secondary"
                        onPress={() => void pullRef(r.name)}
                        isDisabled={pulling === r.name}
                        isPending={pulling === r.name}
                      >
                        Pull
                      </Button>
                    </Tip>
                    <Tip label="Run after pull">
                      <Button
                        size="S"
                        variant="secondary"
                        fillStyle="outline"
                        onPress={() => openRunSheet(r.name)}
                      >
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
          <Button variant="secondary" fillStyle="outline" onPress={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={buildLog}>{buildLog || "Waiting for buildkit…"}</TerminalBlock>
      </GlassSheet>
    </PageShell>
  );
}
