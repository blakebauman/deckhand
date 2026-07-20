import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type ComposeProject } from "@/lib/api";
import {
  ActionButton,
  ActionMenu,
  Button,
  MenuItem,
  MenuSection,
  Text,
} from "@react-spectrum/s2";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { HelpHint } from "@/components/HelpHint";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Area, Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { useUIStore } from "@/stores/uiStore";
import { FolderPlus, RefreshCw } from "lucide-react";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { lucideProps } from "@/components/Icon";

import { copyText, composeProjectKey, composeStatusLabel } from "@/routes/shared";

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
  const [yaml, setYaml] = useState(`services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n`);
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
      const files = (p.configFiles?.length ? p.configFiles : p.path ? [p.path] : []).filter(Boolean);
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
    <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
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
                <Button size="S" variant="secondary" onPress={() => engine.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <ListEmpty
              title="No Compose projects yet"
              description="Engine projects appear automatically. Add a folder to scan, or deploy YAML."
              action={
                <div className={style({ display: "flex", gap: 8 })}>
                  <Button size="S" variant="secondary" onPress={() => setScanOpen(true)}>
                    Scan folders
                  </Button>
                  <Button size="S" onPress={() => setDeployOpen(true)}>
                    Deploy
                  </Button>
                </div>
              }
            />
          )
        }
        actions={
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })} data-no-drag>
            <Tip label="Refresh engine projects">
              <ActionButton
                isQuiet
                aria-label="Refresh projects"
                onPress={() => {
                  void engine.refetch();
                  void scanned.refetch();
                }}
              >
                <RefreshCw {...lucideProps("S")} />
              </ActionButton>
            </Tip>
            <Tip label="Add folders to discover compose files">
              <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setScanOpen(true)}>
                Scan
              </Button>
            </Tip>
            <Tip label="Deploy from YAML or path">
              <Button size="S" onPress={() => setDeployOpen(true)}>
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
                  ? [{ id: "copy-path", label: "Copy path", onAction: () => void copyText(p.path!) }]
                  : []),
              ]}
              suffix={<StatusBadge tone={p.running ? "success" : "muted"}>{label}</StatusBadge>}
            >
              <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                {p.name}
              </div>
              <div
                className={style({ font: "body-xs", color: "neutral-subdued", truncate: true })}
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
              <div className={style({ display: "flex", gap: 8 })}>
                <Button size="S" variant="secondary" onPress={() => setScanOpen(true)}>
                  Scan folders
                </Button>
                <Button size="S" onPress={() => setDeployOpen(true)}>
                  Deploy
                </Button>
              </div>
            }
          />
        }
      >
        {selected ? (
          <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 })}>
            <div
              className={style({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                minWidth: 0,
              })}
            >
              <div className={style({ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })}>
                  <DetailHeading>{selected.name}</DetailHeading>
                  <StatusBadge tone={selected.running ? "success" : "muted"}>
                    {composeStatusLabel(selected)}
                  </StatusBadge>
                  {selected.source === "scan" ? <StatusBadge tone="muted">scan</StatusBadge> : null}
                  <CopyButton value={selected.name} label="Copy name" iconOnly />
                </div>
                <div
                  className={style({
                    font: "code-xs",
                    color: "neutral-subdued",
                    truncate: true,
                    minWidth: 0,
                  })}
                  title={selected.path || undefined}
                >
                  {selected.path || "No compose file path — Down / Restart still work by project name"}
                </div>
              </div>
              <div className={style({ display: "flex", flexShrink: 0, alignItems: "center", gap: 8 })}>
                {selected.running ? (
                  <Button
                    size="S"
                    variant="secondary"
                    onPress={() => void run("Down", () => api.composeDown(bodyFor(selected)), selected.name)}
                  >
                    Down
                  </Button>
                ) : (
                  <Button
                    size="S"
                    variant="accent"
                    isDisabled={!selected.path && !(selected.configFiles?.length)}
                    onPress={() => void run("Deploy", () => api.composeUp(bodyFor(selected)), selected.name)}
                  >
                    Deploy
                  </Button>
                )}
                <ActionMenu aria-label="More project actions" isQuiet align="end" size="S">
                  <MenuSection>
                    {!selected.running && (selected.path || selected.configFiles?.length) ? (
                      <MenuItem
                        id="deploy"
                        textValue="Deploy"
                        onAction={() =>
                          void run("Deploy", () => api.composeUp(bodyFor(selected)), selected.name)
                        }
                      >
                        <Text slot="label">Deploy</Text>
                      </MenuItem>
                    ) : null}
                    {selected.running ? (
                      <MenuItem
                        id="down"
                        textValue="Down"
                        onAction={() =>
                          void run("Down", () => api.composeDown(bodyFor(selected)), selected.name)
                        }
                      >
                        <Text slot="label">Down</Text>
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      id="restart"
                      textValue="Restart"
                      onAction={() =>
                        void run("Restart", () => api.composeRestart(bodyFor(selected)), selected.name)
                      }
                    >
                      <Text slot="label">Restart</Text>
                    </MenuItem>
                    <MenuItem
                      id="ps"
                      textValue="PS"
                      onAction={() => void run("PS", () => api.composePs(bodyFor(selected)), selected.name)}
                    >
                      <Text slot="label">PS</Text>
                    </MenuItem>
                  </MenuSection>
                  {selected.path ? (
                    <MenuSection>
                      <MenuItem
                        id="copy-path"
                        textValue="Copy path"
                        onAction={() => void copyText(selected.path!)}
                      >
                        <Text slot="label">Copy path</Text>
                      </MenuItem>
                    </MenuSection>
                  ) : null}
                </ActionMenu>
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

            <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
              <div
                className={style({
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                })}
              >
                <div className={style({ font: "title-sm" })}>Services</div>
                <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                  {services.isLoading ? "Loading…" : `${(services.data || []).length}`}
                </div>
              </div>
              {services.isError ? (
                <p className={style({ font: "body-sm", color: "negative", margin: 0 })}>
                  {(services.error as Error)?.message || "Could not load services"}
                </p>
              ) : (services.data || []).length === 0 && !services.isLoading ? (
                <p className={style({ font: "body-sm", color: "neutral-subdued", margin: 0 })}>
                  No services reported for this project.
                </p>
              ) : (
                <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
                  {(services.data || []).map((svc) => {
                    const running = (svc.state || svc.status || "").includes("running");
                    return (
                      <div
                        key={svc.name}
                        className={style({
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          paddingX: 12,
                          paddingY: 8,
                          borderRadius: "lg",
                          backgroundColor: "gray-100",
                          minWidth: 0,
                        })}
                      >
                        <div className={style({ flexGrow: 1, minWidth: 0 })}>
                          <div className={style({ font: "body", fontWeight: "medium", truncate: true })}>
                            {svc.name}
                          </div>
                          <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true })}>
                            {svc.image || "—"}
                          </div>
                        </div>
                        {svc.state || svc.status ? (
                          <StatusBadge tone={running ? "success" : "muted"}>
                            {svc.state || svc.status}
                          </StatusBadge>
                        ) : null}
                        <ActionMenu aria-label={`Actions for ${svc.name}`} isQuiet align="end" size="S">
                          <MenuSection>
                            <MenuItem
                              id="start"
                              textValue="Start"
                              isDisabled={running}
                              onAction={() => serviceAction(svc.name, "start")}
                            >
                              <Text slot="label">Start</Text>
                            </MenuItem>
                            <MenuItem
                              id="stop"
                              textValue="Stop"
                              isDisabled={!running}
                              onAction={() => serviceAction(svc.name, "stop")}
                            >
                              <Text slot="label">Stop</Text>
                            </MenuItem>
                            <MenuItem
                              id="restart"
                              textValue="Restart"
                              onAction={() => serviceAction(svc.name, "restart")}
                            >
                              <Text slot="label">Restart</Text>
                            </MenuItem>
                          </MenuSection>
                        </ActionMenu>
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
          <Button variant="secondary" onPress={() => setScanOpen(false)}>
            Done
          </Button>
        }
      >
        <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
          <div className={style({ display: "flex", alignItems: "center", gap: 8, font: "body-xs", color: "neutral-subdued" })}>
            Scan roots
            <HelpHint label="Engine projects from docker compose ls always appear, even without scan roots." />
          </div>
          <div className={style({ display: "flex", gap: 8 })}>
            <Field
              value={newRoot}
              onChange={setNewRoot}
              placeholder="/path/to/projects"
              onKeyDown={(e) => {
                if (e.key === "Enter") addRoot();
              }}
            />
            <Button variant="secondary" aria-label="Add scan root" onPress={addRoot}>
              <FolderPlus {...lucideProps("S")} />
            </Button>
          </div>
          {composeRoots.length > 0 ? (
            <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
              {composeRoots.map((root) => (
                <div
                  key={root}
                  className={style({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    paddingX: 8,
                    paddingY: 4,
                    borderRadius: "default",
                    backgroundColor: "gray-100",
                  })}
                >
                  <span className={style({ font: "code-xs", maxWidth: 280, truncate: true })} title={root}>
                    {root}
                  </span>
                  <ActionButton
                    isQuiet
                    size="XS"
                    aria-label={`Remove ${root}`}
                    onPress={() => removeComposeRoot(root)}
                  >
                    ×
                  </ActionButton>
                </div>
              ))}
            </div>
          ) : (
            <p className={style({ font: "body-sm", color: "neutral-subdued", margin: 0 })}>
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
            <Button
              variant="secondary"
              fillStyle="outline"
              onPress={() => setDeployOpen(false)}
              isDisabled={deployBusy}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              isDisabled={deployBusy}
              isPending={deployBusy}
              onPress={async () => {
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
        <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
          <Field value={projectName} onChange={setProjectName} placeholder="project name" />
          <Field
            value={path}
            onChange={setPath}
            placeholder="compose file or directory path (optional)"
          />
          <Area
            value={yaml}
            onChange={setYaml}
            isDisabled={!!path}
            placeholder="compose YAML"
          />
        </div>
      </GlassSheet>

      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetTitle}
        description={selected?.name || projectName}
        mono
        footer={
          <Button variant="secondary" fillStyle="outline" onPress={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <TerminalBlock copyValue={output}>{output}</TerminalBlock>
      </GlassSheet>
    </div>
  );
}
