import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { Area, Field } from "@/components/Field";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { HelpHint } from "@/components/HelpHint";
import { lucideProps } from "@/components/Icon";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { api, type ComposeProject } from "@/lib/api";
import { composeProjectKey, composeStatusLabel, copyText } from "@/routes/shared";
import { useUIStore } from "@/stores/uiStore";

function basename(path?: string) {
  if (!path) return "";
  const parts = path.replace(/\/+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function ProjectsPage() {
  const qc = useQueryClient();
  const composeRoots = useUIStore((s) => s.composeRoots);
  const addComposeRoot = useUIStore((s) => s.addComposeRoot);
  const removeComposeRoot = useUIStore((s) => s.removeComposeRoot);

  const [q, setQ] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newRoot, setNewRoot] = useState("");
  const [path, setPath] = useState("");
  const [yaml, setYaml] = useState(
    `services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n`,
  );
  const [projectName, setProjectName] = useState("deckhand-demo");
  const [output, setOutput] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("Compose");
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployBusy, setDeployBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const engine = useQuery({
    queryKey: ["compose-projects"],
    queryFn: api.composeProjects,
    refetchInterval: 8000,
  });
  const scanned = useQuery({
    queryKey: ["compose-discover", composeRoots],
    queryFn: () => api.composeDiscover(composeRoots),
    enabled: composeRoots.length > 0,
  });

  const projects = useMemo(() => {
    const byKey = new Map<string, ComposeProject>();

    const upsert = (p: ComposeProject) => {
      const key = composeProjectKey(p);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, p);
        return;
      }
      if (p.source === "engine" || existing.source !== "engine") {
        byKey.set(key, {
          ...existing,
          ...p,
          configFiles: p.configFiles?.length ? p.configFiles : existing.configFiles,
          path: p.path || existing.path,
        });
      }
    };

    for (const p of scanned.data || []) upsert(p);
    for (const p of engine.data || []) {
      const pathMatch = [...byKey.values()].find((s) => s.path && p.path && s.path === p.path);
      if (pathMatch && composeProjectKey(pathMatch) !== composeProjectKey(p)) {
        byKey.delete(composeProjectKey(pathMatch));
      }
      upsert(p);
    }

    return [...byKey.values()].sort((a, b) => {
      if (!!a.running !== !!b.running) return a.running ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [engine.data, scanned.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        (p.path || "").toLowerCase().includes(needle) ||
        (p.status || "").toLowerCase().includes(needle),
    );
  }, [projects, q]);

  const selected = projects.find((p) => composeProjectKey(p) === selectedKey) || null;

  const bodyFor = (
    p?: ComposeProject | null,
    override?: { path?: string; yaml?: string; projectName?: string },
  ) => {
    if (override) {
      return {
        path: override.path || undefined,
        yaml: override.path ? undefined : override.yaml,
        projectName: override.projectName,
      };
    }
    if (p) {
      const files = (p.configFiles?.length ? p.configFiles : p.path ? [p.path] : []).filter(
        Boolean,
      );
      return {
        path: files[0] || undefined,
        configFiles: files.length ? files : undefined,
        projectName: p.name,
      };
    }
    return { path: path || undefined, yaml: path ? undefined : yaml, projectName };
  };

  const services = useQuery({
    queryKey: ["compose-services", selectedKey],
    queryFn: () => api.composeServices(bodyFor(selected)),
    enabled: !!selected,
    refetchInterval: 6000,
  });

  useEffect(() => {
    if (selectedKey && !projects.some((p) => composeProjectKey(p) === selectedKey)) {
      setSelectedKey(null);
    }
  }, [projects, selectedKey]);

  const run = async (label: string, fn: () => Promise<{ output: string }>, nameHint?: string) => {
    setSheetTitle(label);
    setSheetOpen(true);
    setOutput("Running…");
    try {
      const res = await fn();
      setOutput(res.output?.trim() ? res.output : "(no output)");
      toast.success(`Compose ${label}`, { description: nameHint || projectName });
      await qc.invalidateQueries({ queryKey: ["compose-projects"] });
      await qc.invalidateQueries({ queryKey: ["compose-services"] });
      return true;
    } catch (e: any) {
      setOutput(e.message);
      toast.error(`Compose ${label} failed`, { description: e?.message });
      return false;
    }
  };

  const addRoot = () => {
    const trimmed = newRoot.trim();
    if (!trimmed) return;
    addComposeRoot(trimmed);
    setNewRoot("");
    toast.success("Scan root added", { description: trimmed });
  };

  const serviceAction = (svcName: string, action: "start" | "stop" | "restart") => {
    if (!selected) return;
    const label = `${action[0].toUpperCase()}${action.slice(1)} ${svcName}`;
    void run(
      label,
      () =>
        api.composeServiceAction({
          ...bodyFor(selected),
          action,
          services: [svcName],
        }),
      selected.name,
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
      <ListPane
        title="Projects"
        search={{ value: q, onChange: setQ, placeholder: "Search projects" }}
        loading={engine.isLoading && !engine.data}
        empty={
          engine.isError ? (
            <ListEmpty
              title="Couldn’t load Compose projects"
              description={(engine.error as Error)?.message || "Is Docker running?"}
              action={
                <Button size="sm" variant="secondary" onClick={() => engine.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <ListEmpty
              title="No Compose projects yet"
              description="Engine projects appear automatically. Add a folder to scan, or deploy YAML."
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
                    Scan folders
                  </Button>
                  <Button size="sm" onClick={() => setDeployOpen(true)}>
                    Deploy
                  </Button>
                </div>
              }
            />
          )
        }
        actions={
          <div className="flex items-center gap-2" data-no-drag>
            <Tip label="Refresh engine projects">
              <Button
                variant="ghost"
                aria-label="Refresh projects"
                onClick={() => {
                  void engine.refetch();
                  void scanned.refetch();
                }}
              >
                <RefreshCw {...lucideProps("S")} />
              </Button>
            </Tip>
            <Tip label="Add folders to discover compose files">
              <Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
                Scan
              </Button>
            </Tip>
            <Tip label="Deploy from YAML or path">
              <Button size="sm" onClick={() => setDeployOpen(true)}>
                Deploy
              </Button>
            </Tip>
          </div>
        }
      >
        {filtered.map((p) => {
          const key = composeProjectKey(p);
          const label = composeStatusLabel(p);
          return (
            <RowMenu
              key={key}
              active={selectedKey === key}
              onSelect={() => setSelectedKey(key)}
              items={[
                { id: "open", label: "Open", onAction: () => setSelectedKey(key) },
                ...(p.path || p.configFiles?.length
                  ? [
                      {
                        id: "deploy",
                        label: "Deploy",
                        onAction: () => void run("Deploy", () => api.composeUp(bodyFor(p)), p.name),
                      },
                    ]
                  : []),
                {
                  id: "down",
                  label: "Down",
                  onAction: () => void run("Down", () => api.composeDown(bodyFor(p)), p.name),
                },
                {
                  id: "restart",
                  label: "Restart",
                  onAction: () => void run("Restart", () => api.composeRestart(bodyFor(p)), p.name),
                },
                { id: "sep-1", label: "", onAction: () => {} },
                { id: "copy-name", label: "Copy name", onAction: () => void copyText(p.name) },
                ...(p.path
                  ? [
                      {
                        id: "copy-path",
                        label: "Copy path",
                        onAction: () => void copyText(p.path!),
                      },
                    ]
                  : []),
              ]}
              suffix={<StatusBadge tone={p.running ? "success" : "muted"}>{label}</StatusBadge>}
            >
              <div className="min-w-0 text-sm font-medium truncate">{p.name}</div>
              <div
                className="text-muted-foreground text-xs truncate"
                title={p.path || "no compose file"}
              >
                {p.path ? basename(p.path) : "no compose file"}
                {p.source === "scan" ? " · scan" : ""}
              </div>
            </RowMenu>
          );
        })}
      </ListPane>

      <DetailPane
        selectionKey={selectedKey}
        empty={
          <DetailEmpty
            title="Select a Compose project"
            description="Deploy YAML, scan folders for compose files, or pick a project from the list."
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
                  Scan folders
                </Button>
                <Button size="sm" onClick={() => setDeployOpen(true)}>
                  Deploy
                </Button>
              </div>
            }
          />
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <DetailHeading>{selected.name}</DetailHeading>
                  <StatusBadge tone={selected.running ? "success" : "muted"}>
                    {composeStatusLabel(selected)}
                  </StatusBadge>
                  {selected.source === "scan" ? <StatusBadge tone="muted">scan</StatusBadge> : null}
                  <CopyButton value={selected.name} label="Copy name" iconOnly />
                </div>
                <div
                  className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                  title={selected.path || undefined}
                >
                  {selected.path ||
                    "No compose file path — Down / Restart still work by project name"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.running ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void run("Down", () => api.composeDown(bodyFor(selected)), selected.name)
                    }
                  >
                    Down
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={!selected.path && !selected.configFiles?.length}
                    onClick={() =>
                      void run("Deploy", () => api.composeUp(bodyFor(selected)), selected.name)
                    }
                  >
                    Deploy
                  </Button>
                )}
                <MoreActionsMenu label="More project actions">
                  {!selected.running && (selected.path || selected.configFiles?.length) ? (
                    <DropdownMenuItem
                      onClick={() =>
                        void run("Deploy", () => api.composeUp(bodyFor(selected)), selected.name)
                      }
                    >
                      Deploy
                    </DropdownMenuItem>
                  ) : null}
                  {selected.running ? (
                    <DropdownMenuItem
                      onClick={() =>
                        void run("Down", () => api.composeDown(bodyFor(selected)), selected.name)
                      }
                    >
                      Down
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() =>
                      void run(
                        "Restart",
                        () => api.composeRestart(bodyFor(selected)),
                        selected.name,
                      )
                    }
                  >
                    Restart
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void run("PS", () => api.composePs(bodyFor(selected)), selected.name)
                    }
                  >
                    PS
                  </DropdownMenuItem>
                  {selected.path ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void copyText(selected.path!)}>
                        Copy path
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </MoreActionsMenu>
              </div>
            </div>

            <InspectFields
              rows={[
                {
                  label: "Compose file",
                  value: selected.path,
                  mono: true,
                  copy: selected.path,
                },
                {
                  label: "Config files",
                  value:
                    (selected.configFiles?.length || 0) > 1
                      ? selected.configFiles!.join(", ")
                      : undefined,
                  mono: true,
                },
                {
                  label: "Status",
                  value: selected.status || composeStatusLabel(selected),
                },
                {
                  label: "Source",
                  value: selected.source === "scan" ? "folder scan" : "engine",
                },
              ]}
            />

            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-2">
                <div className="text-sm font-semibold">Services</div>
                <div className="text-muted-foreground text-xs">
                  {services.isLoading ? "Loading…" : `${(services.data || []).length}`}
                </div>
              </div>
              {services.isError ? (
                <p className="m-0 text-destructive text-sm">
                  {(services.error as Error)?.message || "Could not load services"}
                </p>
              ) : (services.data || []).length === 0 && !services.isLoading ? (
                <p className="m-0 text-muted-foreground text-sm">
                  No services reported for this project.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {(services.data || []).map((svc) => {
                    const running = (svc.state || svc.status || "").includes("running");
                    return (
                      <div
                        key={svc.name}
                        className="flex items-center gap-3 px-3 py-2 min-w-0 bg-muted rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{svc.name}</div>
                          <div className="text-muted-foreground text-xs truncate">
                            {svc.image || "—"}
                          </div>
                        </div>
                        {svc.state || svc.status ? (
                          <StatusBadge tone={running ? "success" : "muted"}>
                            {svc.state || svc.status}
                          </StatusBadge>
                        ) : null}
                        <MoreActionsMenu label={`Actions for ${svc.name}`}>
                          <DropdownMenuItem
                            disabled={running}
                            onClick={() => serviceAction(svc.name, "start")}
                          >
                            Start
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!running}
                            onClick={() => serviceAction(svc.name, "stop")}
                          >
                            Stop
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => serviceAction(svc.name, "restart")}>
                            Restart
                          </DropdownMenuItem>
                        </MoreActionsMenu>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DetailPane>

      <GlassSheet
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Folder scan"
        description="Walk these roots for compose.yaml / docker-compose.yml (depth 3). Engine projects always appear."
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setScanOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            Scan roots
            <HelpHint label="Engine projects from docker compose ls always appear, even without scan roots." />
          </div>
          <div className="flex gap-2">
            <Field
              value={newRoot}
              onChange={setNewRoot}
              placeholder="/path/to/projects"
              onKeyDown={(e) => {
                if (e.key === "Enter") addRoot();
              }}
            />
            <Button variant="secondary" aria-label="Add scan root" onClick={addRoot}>
              <FolderPlus {...lucideProps("S")} />
            </Button>
          </div>
          {composeRoots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {composeRoots.map((root) => (
                <div
                  key={root}
                  className="inline-flex items-center gap-2 px-2 py-1 bg-muted rounded-md"
                >
                  <span className="max-w-[280px] font-mono text-xs truncate" title={root}>
                    {root}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Remove ${root}`}
                    onClick={() => removeComposeRoot(root)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-muted-foreground text-sm">
              No scan roots yet. Engine Compose projects still list automatically.
            </p>
          )}
        </div>
      </GlassSheet>

      <GlassSheet
        open={deployOpen}
        onOpenChange={setDeployOpen}
        title="Deploy Compose"
        description="From a file path or pasted YAML"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeployOpen(false)} disabled={deployBusy}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={deployBusy}
              onClick={async () => {
                const body = bodyFor(null, { path, yaml, projectName });
                setDeployBusy(true);
                const ok = await run("Deploy", () => api.composeUp(body), projectName);
                setDeployBusy(false);
                if (ok) setDeployOpen(false);
              }}
            >
              Deploy
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field value={projectName} onChange={setProjectName} placeholder="project name" />
          <Field
            value={path}
            onChange={setPath}
            placeholder="compose file or directory path (optional)"
          />
          <Area value={yaml} onChange={setYaml} isDisabled={!!path} placeholder="compose YAML" />
        </div>
      </GlassSheet>

      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetTitle}
        description={selected?.name || projectName}
        mono
        footer={
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={output}>{output}</TerminalBlock>
      </GlassSheet>
    </div>
  );
}
