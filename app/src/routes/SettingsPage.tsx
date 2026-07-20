import { useQuery } from "@tanstack/react-query";
import { Switch, ToggleButton, ToggleButtonGroup } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { LogoWordmark } from "@/components/Logo";
import { PageShell } from "@/components/PageShell";
import { SettingRow, SettingSection } from "@/components/SettingRow";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { APP_VERSION } from "@/lib/version";
import { useUIStore } from "@/stores/uiStore";

export function SettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const startAfterCreate = useUIStore((s) => s.startAfterCreate);
  const setStartAfterCreate = useUIStore((s) => s.setStartAfterCreate);
  const showStoppedContainers = useUIStore((s) => s.showStoppedContainers);
  const setShowStoppedContainers = useUIStore((s) => s.setShowStoppedContainers);
  const confirmPrune = useUIStore((s) => s.confirmPrune);
  const setConfirmPrune = useUIStore((s) => s.setConfirmPrune);
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const info = useQuery({ queryKey: ["docker-info"], queryFn: api.dockerInfo, retry: false });

  return (
    <PageShell title="Settings" description="Appearance and connection status for local runtimes.">
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
        <SettingRow label="Shortcuts" description="Palette and soft refresh">
          <span className={style({ font: "code-xs", color: "neutral-subdued" })}>⌘K · ⌘R</span>
        </SettingRow>
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
      </SettingSection>
      <SettingSection title="Engine">
        <SettingRow label="Docker" description={status.data?.docker.error || "Local Docker engine"}>
          <StatusBadge tone={status.data?.docker.connected ? "success" : "warn"}>
            {status.data?.docker.connected ? "Connected" : "Offline"}
          </StatusBadge>
        </SettingRow>
        <SettingRow label="Server version" description={info.data?.ServerVersion || "—"}>
          <span className={style({ font: "body-xs", color: "neutral-subdued" })}>{info.data?.OperatingSystem || ""}</span>
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
