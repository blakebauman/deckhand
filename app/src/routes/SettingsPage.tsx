import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  NumberField,
  Picker,
  PickerItem,
  Switch,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, type EngineConfig } from "@/lib/api";
import { getLaunchAtLogin, setLaunchAtLogin } from "@/lib/autostart";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { LogoWordmark } from "@/components/Logo";
import { PageShell } from "@/components/PageShell";
import { SettingRow, SettingSection } from "@/components/SettingRow";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { toast } from "@/components/Toaster";
import { modKeyLabel } from "@/lib/hotkeys";
import { isTauriShell } from "@/lib/platform";
import { APP_VERSION } from "@/lib/version";
import { useUIStore } from "@/stores/uiStore";

export function SettingsPage() {
  const qc = useQueryClient();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const startAfterCreate = useUIStore((s) => s.startAfterCreate);
  const setStartAfterCreate = useUIStore((s) => s.setStartAfterCreate);
  const showStoppedContainers = useUIStore((s) => s.showStoppedContainers);
  const setShowStoppedContainers = useUIStore((s) => s.setShowStoppedContainers);
  const confirmPrune = useUIStore((s) => s.confirmPrune);
  const setConfirmPrune = useUIStore((s) => s.setConfirmPrune);
  const sidebarTooltips = useUIStore((s) => s.sidebarTooltips);
  const setSidebarTooltips = useUIStore((s) => s.setSidebarTooltips);
  const [launchAtLogin, setLaunchAtLoginState] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const desktop = isTauriShell();

  useEffect(() => {
    if (!desktop) return;
    void getLaunchAtLogin().then(setLaunchAtLoginState);
  }, [desktop]);

  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const info = useQuery({ queryKey: ["docker-info"], queryFn: api.dockerInfo, retry: false });
  const contexts = useQuery({ queryKey: ["docker-contexts"], queryFn: api.dockerContexts, retry: false });
  const diagnose = useQuery({
    queryKey: ["diagnose"],
    queryFn: api.diagnose,
    retry: false,
    enabled: false,
  });
  const engine = useQuery({ queryKey: ["engine-config"], queryFn: api.engineConfig, retry: false });
  const domains = useQuery({ queryKey: ["domains"], queryFn: api.domainsStatus, retry: false });
  const daemon = useQuery({ queryKey: ["daemon-json"], queryFn: api.daemonJSON, retry: false });
  const audit = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => api.auditLog(80),
    retry: false,
  });

  const [engineMode, setEngineMode] = useState<"attach" | "embed">("attach");
  const [sharesText, setSharesText] = useState("");
  const [cpu, setCpu] = useState(2);
  const [memoryMiB, setMemoryMiB] = useState(4096);
  const [diskGiB, setDiskGiB] = useState(64);
  const [resourceSaver, setResourceSaver] = useState(false);
  const [daemonText, setDaemonText] = useState("{}");
  const [regServer, setRegServer] = useState("");
  const [regUser, setRegUser] = useState("");
  const [regPass, setRegPass] = useState("");
  const [engineBusy, setEngineBusy] = useState(false);
  const [daemonBusy, setDaemonBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    const cfg = engine.data;
    if (!cfg) return;
    setEngineMode(cfg.mode || "attach");
    setSharesText((cfg.virtiofsShares || []).join("\n"));
    setCpu(cfg.cpu ?? 2);
    setMemoryMiB(cfg.memoryMiB ?? 4096);
    setDiskGiB(cfg.diskGiB ?? 64);
    setResourceSaver(!!cfg.resourceSaver);
  }, [engine.data]);

  useEffect(() => {
    if (daemon.data?.json != null) {
      setDaemonText(JSON.stringify(daemon.data.json, null, 2));
    }
  }, [daemon.data]);

  const saveEngine = async () => {
    setEngineBusy(true);
    try {
      const body: Partial<EngineConfig> = {
        mode: engineMode,
        virtiofsShares: sharesText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        cpu,
        memoryMiB,
        diskGiB,
        resourceSaver,
      };
      await api.saveEngineConfig(body);
      await qc.invalidateQueries({ queryKey: ["engine-config"] });
      await qc.invalidateQueries({ queryKey: ["status"] });
      toast.success("Engine config saved");
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message });
    } finally {
      setEngineBusy(false);
    }
  };

  const saveDaemon = async () => {
    setDaemonBusy(true);
    try {
      const json = JSON.parse(daemonText);
      await api.saveDaemonJSON(json);
      await qc.invalidateQueries({ queryKey: ["daemon-json"] });
      toast.success("daemon.json saved");
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message || "Invalid JSON" });
    } finally {
      setDaemonBusy(false);
    }
  };

  const registryLogin = async () => {
    setLoginBusy(true);
    try {
      await api.registryLogin({
        server: regServer.trim() || undefined,
        username: regUser.trim(),
        password: regPass,
      });
      toast.success("Registry login ok", { description: regServer.trim() || "docker.io" });
      setRegPass("");
    } catch (e: any) {
      toast.error("Registry login failed", { description: e?.message });
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <PageShell title="Settings" description="Appearance, engine, and connection status for local runtimes.">
      <SettingSection title="Appearance">
        <SettingRow label="Theme" description="Light, dark, or follow the system">
          <ToggleButtonGroup
            aria-label="Theme"
            size="S"
            density="compact"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[theme]}
            onSelectionChange={(keys) => {
              const v = [...keys][0];
              if (v) setTheme(v as "system" | "light" | "dark");
            }}
          >
            <ToggleButton id="system" aria-label="System — match OS appearance">
              System
            </ToggleButton>
            <ToggleButton id="light">Light</ToggleButton>
            <ToggleButton id="dark">Dark</ToggleButton>
          </ToggleButtonGroup>
        </SettingRow>
        <SettingRow
          label="Shortcuts"
          description={desktop ? "App menu and keyboard" : "Keyboard shortcuts"}
        >
          <span className={style({ font: "code-xs", color: "neutral-subdued" })}>
            {modKeyLabel()}K · {modKeyLabel()}R
          </span>
        </SettingRow>
        <SettingRow
          title="Sidebar tooltips"
          description="Show labels when hovering the icon rail"
          htmlFor="pref-sidebar-tips"
          action={
            <Switch
              id="pref-sidebar-tips"
              isSelected={sidebarTooltips}
              onChange={setSidebarTooltips}
            />
          }
        />
      </SettingSection>

      <SettingSection title="Preferences" description="Defaults for run, lists, and destructive actions">
        <SettingRow
          title="Start after create"
          description="Default for the Run container sheet"
          htmlFor="pref-start"
          action={
            <Switch id="pref-start" isSelected={startAfterCreate} onChange={setStartAfterCreate} />
          }
        />
        <SettingRow
          title="Show stopped containers"
          description="Include exited and created containers in the list"
          htmlFor="pref-stopped"
          action={
            <Switch
              id="pref-stopped"
              isSelected={showStoppedContainers}
              onChange={setShowStoppedContainers}
            />
          }
        />
        <SettingRow
          title="Confirm before prune"
          description="Ask before reclaiming unused disk resources"
          htmlFor="pref-prune"
          action={<Switch id="pref-prune" isSelected={confirmPrune} onChange={setConfirmPrune} />}
        />
        <SettingRow
          title="Launch at login"
          description={
            desktop
              ? "Start Deckhand when you sign in to this computer"
              : "Available in the desktop app only"
          }
          htmlFor="pref-autostart"
          action={
            <Switch
              id="pref-autostart"
              isSelected={launchAtLogin}
              isDisabled={!desktop || launchBusy}
              onChange={(enabled) => {
                setLaunchBusy(true);
                void setLaunchAtLogin(enabled)
                  .then(() => {
                    setLaunchAtLoginState(enabled);
                    toast.success(enabled ? "Launch at login on" : "Launch at login off");
                  })
                  .catch((e: any) =>
                    toast.error("Could not update launch at login", {
                      description: e?.message || String(e),
                    }),
                  )
                  .finally(() => setLaunchBusy(false));
              }}
            />
          }
        />
      </SettingSection>

      <SettingSection title="Docker context" description="Switch the active Docker CLI/API context">
        <SettingRow
          title="Active context"
          description={contexts.data?.current || "—"}
          action={
            <Picker
              aria-label="Docker context"
              size="S"
              placeholder="Context"
              styles={style({ minWidth: 160, maxWidth: 256 })}
              value={contexts.data?.current ?? null}
              onChange={(key) => {
                const name = String(key);
                void api
                  .useDockerContext(name)
                  .then(async () => {
                    await qc.invalidateQueries({ queryKey: ["docker-contexts"] });
                    await qc.invalidateQueries({ queryKey: ["status"] });
                    await qc.invalidateQueries({ queryKey: ["docker-info"] });
                    await qc.invalidateQueries({ queryKey: ["containers"] });
                    await qc.invalidateQueries({ queryKey: ["docker-dashboard"] });
                    toast.success("Docker context switched", { description: name });
                  })
                  .catch((e: any) =>
                    toast.error("Context switch failed", { description: e?.message }),
                  );
              }}
            >
              {(contexts.data?.contexts || []).map((c) => (
                <PickerItem key={c.name} id={c.name}>
                  {c.name}
                </PickerItem>
              ))}
            </Picker>
          }
        />
      </SettingSection>

      <SettingSection title="Diagnose" description="Connectivity and tool versions">
        <SettingRow
          title="Report"
          description={diagnose.data?.time || "Run a diagnose pass against the sidecar"}
          action={
            <Button
              size="S"
              variant="secondary"
              onPress={() =>
                void diagnose.refetch().then((r) => {
                  if (r.isError) {
                    toast.error("Diagnose failed", {
                      description: (r.error as Error)?.message,
                    });
                  }
                })
              }
              isPending={diagnose.isFetching}
            >
              Refresh
            </Button>
          }
        >
          {diagnose.data ? (
            <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                <StatusBadge tone={diagnose.data.ok ? "success" : "destructive"}>
                  {diagnose.data.ok ? "ok" : "issues"}
                </StatusBadge>
                {diagnose.data.activeContext ? (
                  <StatusBadge tone="muted">{diagnose.data.activeContext}</StatusBadge>
                ) : null}
              </div>
              <dl
                className={style({
                  display: "grid",
                  gridTemplateColumns: {
                    default: "1fr",
                    sm: "120px 1fr",
                  },
                  gap: 8,
                  font: "body-xs",
                  margin: 0,
                })}
              >
                {[
                  ["OS", diagnose.data.goos],
                  ["Docker host", diagnose.data.dockerHost],
                  ["Server", diagnose.data.serverVersion],
                  ["Ping", diagnose.data.pingError || "ok"],
                  ["Compose", diagnose.data.compose],
                  ["Buildx", diagnose.data.buildx],
                  ["Helm", diagnose.data.helm],
                ].map(([k, v]) =>
                  v ? (
                    <div key={k} className={style({ display: "contents" })}>
                      <dt className={style({ color: "neutral-subdued", margin: 0 })}>{k}</dt>
                      <dd className={style({ margin: 0, font: "code-xs", truncate: true })} title={String(v)}>
                        {String(v)}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {(diagnose.data.notes || []).length ? (
                <ul className={style({ margin: 0, paddingStart: 16, font: "body-xs", color: "neutral-subdued" })}>
                  {diagnose.data.notes!.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0 })}>
              No report yet.
            </p>
          )}
        </SettingRow>
      </SettingSection>

      <SettingSection title="Engine mode" description="Attach to an existing engine or embed a local VM">
        <SettingRow title="Mode" description={engine.data?.embedStatus || "attach uses DOCKER_HOST / context"}>
          <ToggleButtonGroup
            aria-label="Engine mode"
            size="S"
            density="compact"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[engineMode]}
            onSelectionChange={(keys) => {
              const v = [...keys][0];
              if (v === "attach" || v === "embed") setEngineMode(v);
            }}
          >
            <ToggleButton id="attach">Attach</ToggleButton>
            <ToggleButton id="embed" isDisabled={!engine.data?.embedAvailable}>
              Embed
            </ToggleButton>
          </ToggleButtonGroup>
        </SettingRow>
        <SettingRow
          title="Virtiofs shares"
          description="Host paths shared into the embed VM (one per line)"
        >
          <TextArea
            aria-label="Virtiofs shares"
            value={sharesText}
            onChange={setSharesText}
            placeholder={"/Users/me/Projects\n/tmp/share"}
            styles={style({ width: "full" })}
          />
        </SettingRow>
        <SettingRow title="Resources" description="CPU, memory, and disk for the embed VM">
          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                sm: "1fr 1fr 1fr",
              },
              gap: 12,
            })}
          >
            <NumberField label="CPU" value={cpu} onChange={setCpu} minValue={1} />
            <NumberField label="Memory (MiB)" value={memoryMiB} onChange={setMemoryMiB} minValue={512} />
            <NumberField label="Disk (GiB)" value={diskGiB} onChange={setDiskGiB} minValue={8} />
          </div>
        </SettingRow>
        <SettingRow
          title="Resource saver"
          description="Idle the embed VM when unused"
          htmlFor="engine-saver"
          action={
            <Switch
              id="engine-saver"
              isSelected={resourceSaver}
              onChange={setResourceSaver}
            />
          }
        />
        <SettingRow title="Save" description="Write engine configuration">
          <Button size="S" onPress={() => void saveEngine()} isPending={engineBusy}>
            Save engine config
          </Button>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Domains" description="Local *.local style DNS for containers">
        <SettingRow
          title="Enable domains"
          description={domains.data?.hint || domains.data?.suffix || "Optional local DNS helper"}
          htmlFor="domains-enabled"
          action={
            <Switch
              id="domains-enabled"
              isSelected={!!domains.data?.enabled}
              onChange={(enabled) => {
                void api
                  .setDomainsEnabled(enabled)
                  .then(async () => {
                    await qc.invalidateQueries({ queryKey: ["domains"] });
                    toast.success(enabled ? "Domains enabled" : "Domains disabled");
                  })
                  .catch((e: any) =>
                    toast.error("Domains update failed", { description: e?.message }),
                  );
              }}
            />
          }
        />
        {domains.data?.addr ? (
          <SettingRow label="HTTP" description={domains.data.addr}>
            <StatusBadge tone={domains.data.enabled ? "success" : "muted"}>
              {domains.data.enabled ? "active" : "off"}
            </StatusBadge>
          </SettingRow>
        ) : null}
        {domains.data?.httpsAddr ? (
          <SettingRow
            label="HTTPS"
            description={`${domains.data.httpsAddr} · self-signed (browser warning expected)`}
          >
            <StatusBadge tone={domains.data.enabled ? "success" : "muted"}>TLS</StatusBadge>
          </SettingRow>
        ) : null}
        {domains.data?.dns?.note ? (
          <SettingRow label="DNS setup" description={domains.data.dns.note}>
            <span className={style({ font: "code-xs", color: "neutral-subdued" })}>
              {domains.data.dns.macosResolverPath || "/etc/resolver/deckhand.local"}
            </span>
          </SettingRow>
        ) : null}
        {domains.data?.dns?.hostsExample ? (
          <SettingRow label="Hosts example" description={domains.data.dns.hostsExample}>
            <span className={style({ font: "code-xs", color: "neutral-subdued" })}>hosts</span>
          </SettingRow>
        ) : null}
      </SettingSection>

      <SettingSection title="Daemon JSON" description={daemon.data?.path || "Edit Docker daemon.json"}>
        <SettingRow title="JSON" description="Invalid JSON will be rejected on save">
          <TextArea
            aria-label="daemon.json"
            value={daemonText}
            onChange={setDaemonText}
            styles={style({ width: "full" })}
          />
        </SettingRow>
        <SettingRow title="Save" description="Write daemon.json (may require engine restart)">
          <Button size="S" onPress={() => void saveDaemon()} isPending={daemonBusy}>
            Save daemon.json
          </Button>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Audit log" description={audit.data?.path || "Recent sidecar actions"}>
        <SettingRow
          title="Recent events"
          description={`${audit.data?.events?.length ?? 0} events`}
          action={
            <Button size="S" variant="secondary" onPress={() => void audit.refetch()}>
              Refresh
            </Button>
          }
        >
          <div
            className={style({
              maxHeight: 240,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            })}
          >
            {(audit.data?.events || []).length === 0 ? (
              <p className={style({ font: "body-xs", color: "neutral-subdued", margin: 0 })}>
                No audit events yet.
              </p>
            ) : (
              (audit.data?.events || []).map((ev, i) => (
                <div
                  key={`${ev.time}-${ev.action}-${i}`}
                  className={style({
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: 8,
                    font: "body-xs",
                  })}
                >
                  <StatusBadge tone={ev.ok ? "success" : "destructive"}>{ev.ok ? "ok" : "err"}</StatusBadge>
                  <span className={style({ font: "code-xs", color: "neutral-subdued" })}>
                    {ev.time}
                  </span>
                  <span className={style({ fontWeight: "medium" })}>{ev.action}</span>
                  {ev.target ? (
                    <span className={style({ color: "neutral-subdued", truncate: true, minWidth: 0 })}>
                      {ev.target}
                    </span>
                  ) : null}
                  {ev.error ? (
                    <span className={style({ color: "negative", truncate: true })}>{ev.error}</span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Registry login" description="docker login against a registry">
        <SettingRow title="Credentials">
          <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
            <TextField
              label="Server"
              value={regServer}
              onChange={setRegServer}
              placeholder="docker.io (optional)"
            />
            <TextField label="Username" value={regUser} onChange={setRegUser} />
            <TextField
              label="Password"
              type="password"
              value={regPass}
              onChange={setRegPass}
            />
            <Button
              size="S"
              onPress={() => void registryLogin()}
              isDisabled={!regUser.trim() || !regPass || loginBusy}
              isPending={loginBusy}
            >
              Log in
            </Button>
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Engine">
        <SettingRow label="Docker" description={status.data?.docker.error || "Local Docker engine"}>
          <StatusBadge tone={status.data?.docker.connected ? "success" : "muted"}>
            {status.data?.docker.connected ? "Connected" : "Offline"}
          </StatusBadge>
        </SettingRow>
        <SettingRow label="Server version" description={info.data?.ServerVersion || "—"}>
          <span className={style({ font: "body-xs", color: "neutral-subdued" })}>
            {info.data?.OperatingSystem || ""}
          </span>
        </SettingRow>
        <div className={style({ paddingX: 20, paddingY: 16 })}>
          <DiskUsagePanel />
        </div>
      </SettingSection>

      <SettingSection title="Kubernetes">
        <SettingRow label="Cluster" description={status.data?.kubernetes.error || "kubeconfig"}>
          <StatusBadge tone={status.data?.kubernetes.connected ? "success" : "muted"}>
            {status.data?.kubernetes.connected ? status.data.kubernetes.version : "Offline"}
          </StatusBadge>
        </SettingRow>
      </SettingSection>

      <SettingSection title="About">
        <div className={style({ paddingX: 20, paddingY: 16 })}>
          <LogoWordmark />
          <p className={style({ font: "body-xs", color: "neutral-subdued", marginTop: 12 })}>
            Local-first Docker and Kubernetes desktop. Original mark: boat hook securing containers.
          </p>
        </div>
        <SettingRow label="Version" description="Desktop app build">
          <span className={style({ font: "code-xs", color: "neutral-subdued" })}>v{APP_VERSION}</span>
        </SettingRow>
      </SettingSection>
    </PageShell>
  );
}
