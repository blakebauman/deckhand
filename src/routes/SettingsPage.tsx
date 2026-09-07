import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { LogoWordmark } from "@/components/Logo";
import { PageShell } from "@/components/PageShell";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SettingRow, SettingSection } from "@/components/SettingRow";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDockerReconnect } from "@/hooks/useDockerReconnect";
import { api, type EngineConfig } from "@/lib/api";
import { getLaunchAtLogin, setLaunchAtLogin } from "@/lib/autostart";
import { modKeyLabel } from "@/lib/hotkeys";
import { isTauriShell } from "@/lib/platform";
import { APP_VERSION } from "@/lib/version";
import { useUIStore } from "@/stores/uiStore";

export function SettingsPage() {
  const qc = useQueryClient();
  const { reconnect, pending: reconnecting } = useDockerReconnect();
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
  const contexts = useQuery({
    queryKey: ["docker-contexts"],
    queryFn: api.dockerContexts,
    retry: false,
  });
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
    <PageShell
      title="Settings"
      description="Appearance, engine, and connection status for local runtimes."
    >
      <div className="max-w-3xl">
        <SettingSection title="Appearance">
          <SettingRow title="Theme" description="Light, dark, or follow the system">
            <SegmentedControl
              aria-label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { id: "system", label: "System", "aria-label": "System — match OS appearance" },
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
            />
          </SettingRow>
          <SettingRow
            title="Shortcuts"
            description={desktop ? "App menu and keyboard" : "Keyboard shortcuts"}
          >
            <span className="font-mono text-xs text-muted-foreground">
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
                checked={sidebarTooltips}
                onCheckedChange={setSidebarTooltips}
              />
            }
          />
        </SettingSection>

        <SettingSection
          title="Preferences"
          description="Defaults for run, lists, and destructive actions"
        >
          <SettingRow
            title="Start after create"
            description="Default for the Run container sheet"
            htmlFor="pref-start"
            action={
              <Switch
                id="pref-start"
                checked={startAfterCreate}
                onCheckedChange={setStartAfterCreate}
              />
            }
          />
          <SettingRow
            title="Show stopped containers"
            description="Include exited and created containers in the list"
            htmlFor="pref-stopped"
            action={
              <Switch
                id="pref-stopped"
                checked={showStoppedContainers}
                onCheckedChange={setShowStoppedContainers}
              />
            }
          />
          <SettingRow
            title="Confirm before prune"
            description="Ask before reclaiming unused disk resources"
            htmlFor="pref-prune"
            action={
              <Switch id="pref-prune" checked={confirmPrune} onCheckedChange={setConfirmPrune} />
            }
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
                checked={launchAtLogin}
                disabled={!desktop || launchBusy}
                onCheckedChange={(enabled) => {
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

        <SettingSection
          title="Docker context"
          description="Switch the active Docker CLI/API context"
        >
          <SettingRow
            title="Active context"
            description={contexts.data?.current || "—"}
            action={
              <Select
                value={contexts.data?.current ?? undefined}
                onValueChange={(name) => {
                  if (!name) return;
                  void api
                    .switchDockerContext(name)
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
                <SelectTrigger aria-label="Docker context" className="min-w-[160px] max-w-[256px]">
                  <SelectValue placeholder="Context" />
                </SelectTrigger>
                <SelectContent>
                  {(contexts.data?.contexts || []).map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </SettingSection>

        <SettingSection title="Diagnose" description="Connectivity and tool versions">
          <SettingRow
            title="Report"
            description={diagnose.data?.time || "Run a diagnose pass against the sidecar"}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() =>
                    void reconnect().then(() => {
                      void diagnose.refetch();
                    })
                  }
                >
                  Reconnect
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void diagnose.refetch().then((r) => {
                      if (r.isError) {
                        toast.error("Diagnose failed", {
                          description: (r.error as Error)?.message,
                        });
                      }
                    })
                  }
                >
                  Refresh
                </Button>
              </div>
            }
          >
            {diagnose.data ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={diagnose.data.ok ? "success" : "destructive"}>
                    {diagnose.data.ok ? "ok" : "issues"}
                  </StatusBadge>
                  {diagnose.data.activeContext ? (
                    <StatusBadge tone="muted">{diagnose.data.activeContext}</StatusBadge>
                  ) : null}
                </div>
                <dl className="m-0 grid gap-2 text-xs sm:grid-cols-2">
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
                      <div key={k} className="min-w-0">
                        <dt className="m-0 text-muted-foreground">{k}</dt>
                        <dd className="m-0 truncate font-mono text-xs" title={String(v)}>
                          {String(v)}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
                {(diagnose.data.notes || []).length ? (
                  <ul className="m-0 ps-4 text-xs text-muted-foreground">
                    {diagnose.data.notes!.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="m-0 text-xs text-muted-foreground">No report yet.</p>
            )}
          </SettingRow>
        </SettingSection>

        <SettingSection
          title="Engine mode"
          description="Attach to an existing engine or embed a local VM"
        >
          <SettingRow
            title="Mode"
            description={engine.data?.embedStatus || "attach uses DOCKER_HOST / context"}
          >
            <SegmentedControl
              aria-label="Engine mode"
              value={engineMode}
              onChange={setEngineMode}
              options={[
                { id: "attach", label: "Attach" },
                {
                  id: "embed",
                  label: "Embed",
                  disabled: !engine.data?.embedAvailable,
                },
              ]}
            />
          </SettingRow>
          <SettingRow
            title="Virtiofs shares"
            description="Host paths shared into the embed VM (one per line)"
          >
            <Textarea
              aria-label="Virtiofs shares"
              value={sharesText}
              onChange={(e) => setSharesText(e.target.value)}
              placeholder={"/Users/me/Projects\n/tmp/share"}
              className="w-full"
            />
          </SettingRow>
          <SettingRow title="Resources" description="CPU, memory, and disk for the embed VM">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="engine-cpu">CPU</Label>
                <Input
                  id="engine-cpu"
                  type="number"
                  min={1}
                  value={cpu}
                  onChange={(e) => setCpu(Number(e.target.value) || 1)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="engine-memory">Memory (MiB)</Label>
                <Input
                  id="engine-memory"
                  type="number"
                  min={512}
                  value={memoryMiB}
                  onChange={(e) => setMemoryMiB(Number(e.target.value) || 512)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="engine-disk">Disk (GiB)</Label>
                <Input
                  id="engine-disk"
                  type="number"
                  min={8}
                  value={diskGiB}
                  onChange={(e) => setDiskGiB(Number(e.target.value) || 8)}
                />
              </div>
            </div>
          </SettingRow>
          <SettingRow
            title="Resource saver"
            description="Idle the embed VM when unused"
            htmlFor="engine-saver"
            action={
              <Switch
                id="engine-saver"
                checked={resourceSaver}
                onCheckedChange={setResourceSaver}
              />
            }
          />
          <SettingRow title="Save" description="Write engine configuration">
            <Button size="sm" disabled={engineBusy} onClick={() => void saveEngine()}>
              {engineBusy ? "Saving…" : "Save engine config"}
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
                checked={!!domains.data?.enabled}
                onCheckedChange={(enabled) => {
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
            <SettingRow title="HTTP" description={domains.data.addr}>
              <StatusBadge tone={domains.data.enabled ? "success" : "muted"}>
                {domains.data.enabled ? "active" : "off"}
              </StatusBadge>
            </SettingRow>
          ) : null}
          {domains.data?.httpsAddr ? (
            <SettingRow
              title="HTTPS"
              description={`${domains.data.httpsAddr} · self-signed (browser warning expected)`}
            >
              <StatusBadge tone={domains.data.enabled ? "success" : "muted"}>TLS</StatusBadge>
            </SettingRow>
          ) : null}
          {domains.data?.dns?.note ? (
            <SettingRow title="DNS setup" description={domains.data.dns.note}>
              <span className="font-mono text-xs text-muted-foreground">
                {domains.data.dns.macosResolverPath || "/etc/resolver/deckhand.local"}
              </span>
            </SettingRow>
          ) : null}
          {domains.data?.dns?.hostsExample ? (
            <SettingRow title="Hosts example" description={domains.data.dns.hostsExample}>
              <span className="font-mono text-xs text-muted-foreground">hosts</span>
            </SettingRow>
          ) : null}
        </SettingSection>

        <SettingSection
          title="Daemon JSON"
          description={daemon.data?.path || "Edit Docker daemon.json"}
        >
          <SettingRow title="JSON" description="Invalid JSON will be rejected on save">
            <Textarea
              aria-label="daemon.json"
              value={daemonText}
              onChange={(e) => setDaemonText(e.target.value)}
              className="w-full"
            />
          </SettingRow>
          <SettingRow title="Save" description="Write daemon.json (may require engine restart)">
            <Button size="sm" disabled={daemonBusy} onClick={() => void saveDaemon()}>
              {daemonBusy ? "Saving…" : "Save daemon.json"}
            </Button>
          </SettingRow>
        </SettingSection>

        <SettingSection
          title="Audit log"
          description={audit.data?.path || "Recent sidecar actions"}
        >
          <SettingRow
            title="Recent events"
            description={`${audit.data?.events?.length ?? 0} events`}
            action={
              <Button size="sm" variant="secondary" onClick={() => void audit.refetch()}>
                Refresh
              </Button>
            }
          >
            <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
              {(audit.data?.events || []).length === 0 ? (
                <p className="m-0 text-xs text-muted-foreground">No audit events yet.</p>
              ) : (
                (audit.data?.events || []).map((ev, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: index only disambiguates an otherwise-composite key
                    key={`${ev.time}-${ev.action}-${i}`}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <StatusBadge tone={ev.ok ? "success" : "destructive"}>
                      {ev.ok ? "ok" : "err"}
                    </StatusBadge>
                    <span className="font-mono text-xs text-muted-foreground">{ev.time}</span>
                    <span className="font-medium">{ev.action}</span>
                    {ev.target ? (
                      <span className="min-w-0 truncate text-muted-foreground">{ev.target}</span>
                    ) : null}
                    {ev.error ? (
                      <span className="truncate text-destructive">{ev.error}</span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </SettingRow>
        </SettingSection>

        <SettingSection title="Registry login" description="docker login against a registry">
          <SettingRow title="Credentials">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-server">Server</Label>
                <Input
                  id="reg-server"
                  value={regServer}
                  onChange={(e) => setRegServer(e.target.value)}
                  placeholder="docker.io (optional)"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-user">Username</Label>
                <Input id="reg-user" value={regUser} onChange={(e) => setRegUser(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-pass">Password</Label>
                <Input
                  id="reg-pass"
                  type="password"
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                className="w-fit"
                onClick={() => void registryLogin()}
                disabled={!regUser.trim() || !regPass || loginBusy}
              >
                {loginBusy ? "Logging in…" : "Log in"}
              </Button>
            </div>
          </SettingRow>
        </SettingSection>

        <SettingSection title="Engine">
          <SettingRow
            title="Docker"
            description={
              status.data?.docker.error ||
              status.data?.docker.activeContext ||
              "Local Docker engine (attach)"
            }
            action={
              <div className="flex items-center gap-2">
                <StatusBadge tone={status.data?.docker.connected ? "success" : "muted"}>
                  {status.data?.docker.connected ? "Connected" : "Offline"}
                </StatusBadge>
                {!status.data?.docker.connected ? (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={reconnecting}
                    onClick={() => void reconnect()}
                  >
                    Reconnect
                  </Button>
                ) : null}
              </div>
            }
          />
          <SettingRow title="Server version" description={info.data?.ServerVersion || "—"}>
            <span className="text-xs text-muted-foreground">
              {info.data?.OperatingSystem || ""}
            </span>
          </SettingRow>
          <div className="px-4 py-3">
            <DiskUsagePanel />
          </div>
        </SettingSection>

        <SettingSection title="Kubernetes">
          <SettingRow title="Cluster" description={status.data?.kubernetes.error || "kubeconfig"}>
            <StatusBadge tone={status.data?.kubernetes.connected ? "success" : "muted"}>
              {status.data?.kubernetes.connected ? status.data.kubernetes.version : "Offline"}
            </StatusBadge>
          </SettingRow>
        </SettingSection>

        <SettingSection title="About">
          <div className="px-4 py-3">
            <LogoWordmark />
            <p className="mt-2.5 text-xs text-muted-foreground">
              Local-first Docker and Kubernetes desktop. Original mark: boat hook securing
              containers.
            </p>
          </div>
          <SettingRow title="Version" description="Desktop app build">
            <span className="font-mono text-xs text-muted-foreground">v{APP_VERSION}</span>
          </SettingRow>
        </SettingSection>
      </div>
    </PageShell>
  );
}
