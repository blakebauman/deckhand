import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ActionButton, Button } from "@react-spectrum/s2";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet, TerminalBlock } from "@/components/GlassSheet";
import { HelpHint } from "@/components/HelpHint";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Area, Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { useUIStore } from "@/stores/uiStore";
import FolderAdd from "@react-spectrum/s2/icons/FolderAdd";
import DataRefresh from "@react-spectrum/s2/icons/DataRefresh";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };

import { copyText, composeProjectKey, composeStatusLabel } from "@/routes/shared";
import type { ComposeProject } from "@/lib/api";

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
      // Engine status/path wins; keep any extra scan metadata.
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
      // Match scanned rows that share a compose file path even if names differ.
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

  const folderScan = (
    <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
      <div className={style({ display: "flex", alignItems: "center", gap: 8, font: "body-xs", color: "neutral-subdued" })}>
        Folder scan
        <HelpHint label="Walk these roots for compose.yaml / docker-compose.yml (depth 3). Engine projects from docker compose ls always appear." />
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
          <FolderAdd styles={iconStyle({ size: "S" })} />
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
              <span className={style({ font: "code-xs", maxWidth: 224, truncate: true })} title={root}>
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
        <p className={style({ font: "body-xs", color: "neutral-subdued" })}>
          No scan roots yet. Engine Compose projects still list automatically.
        </p>
      )}
    </div>
  );

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}>
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
              description="Engine projects appear automatically. Add a folder to scan for compose files."
              action={
                <Button size="S" onPress={() => setDeployOpen(true)}>
                  Deploy YAML
                </Button>
              }
            />
          )
        }
        actions={
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
            <Tip label="Refresh engine projects">
              <ActionButton
                isQuiet
                aria-label="Refresh projects"
                onPress={() => {
                  void engine.refetch();
                  void scanned.refetch();
                }}
              >
                <DataRefresh />
              </ActionButton>
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
              items={[
                { id: "open", label: "Open", onAction: () => setSelectedKey(key) },
                ...(p.path || p.configFiles?.length
                  ? [{ id: "deploy", label: "Deploy", onAction: () => void run("Deploy", () => api.composeUp(bodyFor(p)), p.name) }]
                  : []),
                { id: "down", label: "Down", onAction: () => void run("Down", () => api.composeDown(bodyFor(p)), p.name) },
                {
                  id: "restart",
                  label: "Restart",
                  onAction: () => void run("Restart", () => api.composeRestart(bodyFor(p)), p.name),
                },
                { id: "sep-1", label: "", onAction: () => {} },
                { id: "copy-name", label: "Copy name", onAction: () => void copyText(p.name) },
                ...(p.path ? [{ id: "copy-path", label: "Copy path", onAction: () => void copyText(p.path!) }] : []),
              ]}
              suffix={<StatusBadge tone={p.running ? "success" : "muted"}>{label}</StatusBadge>}
            >
              <ListItem active={selectedKey === key} onClick={() => setSelectedKey(key)}>
                <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
                  {p.name}
                </div>
                <div
                  className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, marginTop: 2 })}
                  title={p.path || "no compose file"}
                >
                  {p.path || "no compose file"}
                </div>
              </ListItem>
            </RowMenu>
          );
        })}
      </ListPane>

      <div className={style({ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, minHeight: 0 })}>
        <DetailPane
          selectionKey={selectedKey}
          empty={
            <DetailEmpty
              title="Select a Compose project"
              description="Or deploy from YAML / a file path. Folder scan stays available below."
              action={
                <Button size="S" onPress={() => setDeployOpen(true)}>
                  Deploy YAML
                </Button>
              }
            />
          }
          header={
            selected ? (
              <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
                <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0 })}>
                  <DetailHeading>{selected.name}</DetailHeading>
                  <StatusBadge tone={selected.running ? "success" : "muted"}>
                    {selected.running ? selected.status || "running" : composeStatusLabel(selected)}
                  </StatusBadge>
                  {selected.source === "scan" ? <StatusBadge tone="muted">folder scan</StatusBadge> : null}
                  <CopyButton value={selected.name} label="Copy name" iconOnly />
                </div>
                <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                  {selected.path ? (
                    <Button
                      size="S"
                      onPress={() => void run("Deploy", () => api.composeUp(bodyFor(selected)), selected.name)}
                    >
                      Deploy
                    </Button>
                  ) : null}
                  <Button
                    size="S"
                    variant="secondary"
                    onPress={() => void run("Down", () => api.composeDown(bodyFor(selected)), selected.name)}
                  >
                    Down
                  </Button>
                  <Button
                    size="S"
                    variant="secondary"
                    fillStyle="outline"
                    onPress={() => void run("Restart", () => api.composeRestart(bodyFor(selected)), selected.name)}
                  >
                    Restart
                  </Button>
                  <Button
                    size="S"
                    variant="secondary"
                    fillStyle="outline"
                    onPress={() => void run("PS", () => api.composePs(bodyFor(selected)), selected.name)}
                  >
                    PS
                  </Button>
                </div>
              </div>
            ) : null
          }
        >
          {selected ? (
            <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 })}>
              {selected.path ? (
                <div className={style({ backgroundColor: "layer-2", borderRadius: "xl", paddingX: 16, paddingY: 12 })}>
                  <div className={style({ font: "body-xs", color: "neutral-subdued", marginBottom: 4 })}>
                    Compose file
                  </div>
                  <div className={style({ display: "flex", alignItems: "start", gap: 8 })}>
                    <code className={style({ font: "code-xs", flexGrow: 1, minWidth: 0, truncate: true })}>
                      {selected.path}
                    </code>
                    <CopyButton value={selected.path} label="Copy path" iconOnly />
                  </div>
                </div>
              ) : (
                <p className={style({ font: "body-sm", color: "neutral-subdued" })}>
                  No compose file on disk for this engine project (stale config paths were dropped).
                  Down / Restart still work by project name.
                </p>
              )}
              {(selected.configFiles?.length || 0) > 1 ? (
                <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                    Config files
                  </div>
                  {selected.configFiles!.map((f) => (
                    <div key={f} className={style({ color: "neutral-subdued", font: "body-xs" })}>
                      {f}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                <div className={style({ font: "body-xs", color: "neutral-subdued" })}>Services</div>
                {services.isLoading ? (
                  <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0 })}>Loading…</p>
                ) : services.isError ? (
                  <p className={style({ font: "body-xs", color: "negative", margin: 0 })}>
                    {(services.error as Error)?.message || "Could not load services"}
                  </p>
                ) : (services.data || []).length === 0 ? (
                  <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0 })}>
                    No services reported for this project.
                  </p>
                ) : (
                  (services.data || []).map((svc) => (
                    <div
                      key={svc.name}
                      className={style({
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: "layer-2",
                        borderRadius: "xl",
                        paddingX: 12,
                        paddingY: 12,
                      })}
                    >
                      <div className={style({ flexGrow: 1, minWidth: 0 })}>
                        <div className={style({ font: "body", fontWeight: "medium", truncate: true })}>
                          {svc.name}
                        </div>
                        <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true })}>
                          {svc.image || svc.status || svc.state || "—"}
                        </div>
                      </div>
                      {svc.state || svc.status ? (
                        <StatusBadge tone={(svc.state || svc.status || "").includes("running") ? "success" : "muted"}>
                          {svc.state || svc.status}
                        </StatusBadge>
                      ) : null}
                      <Button
                        size="S"
                        variant="secondary"
                        onPress={() =>
                          void run(
                            `Start ${svc.name}`,
                            () =>
                              api.composeServiceAction({
                                ...bodyFor(selected),
                                action: "start",
                                services: [svc.name],
                              }),
                            selected.name,
                          )
                        }
                      >
                        Start
                      </Button>
                      <Button
                        size="S"
                        variant="secondary"
                        fillStyle="outline"
                        onPress={() =>
                          void run(
                            `Stop ${svc.name}`,
                            () =>
                              api.composeServiceAction({
                                ...bodyFor(selected),
                                action: "stop",
                                services: [svc.name],
                              }),
                            selected.name,
                          )
                        }
                      >
                        Stop
                      </Button>
                      <Button
                        size="S"
                        variant="secondary"
                        fillStyle="outline"
                        onPress={() =>
                          void run(
                            `Restart ${svc.name}`,
                            () =>
                              api.composeServiceAction({
                                ...bodyFor(selected),
                                action: "restart",
                                services: [svc.name],
                              }),
                            selected.name,
                          )
                        }
                      >
                        Restart
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </DetailPane>

        <div className={style({ flexShrink: 0, paddingX: 4, paddingY: 16, marginTop: 8 })}>{folderScan}</div>
      </div>

      <GlassSheet
        open={deployOpen}
        onOpenChange={setDeployOpen}
        title="Deploy Compose"
        description="From a file path or pasted YAML"
        footer={
          <>
            <Button variant="secondary" fillStyle="outline" onPress={() => setDeployOpen(false)} isDisabled={deployBusy}>
              Cancel
            </Button>
            <Button
              isDisabled={deployBusy}
              onPress={async () => {
                const body = bodyFor(null, { path, yaml, projectName });
                setDeployBusy(true);
                const ok = await run("Deploy", () => api.composeUp(body), projectName);
                setDeployBusy(false);
                if (ok) setDeployOpen(false);
              }}
            >
              {deployBusy ? "Deploying…" : "Deploy"}
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
