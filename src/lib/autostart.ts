import { isTauriShell } from "@/lib/platform";

export async function getLaunchAtLogin(): Promise<boolean> {
  if (!isTauriShell()) return false;
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart");
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (!isTauriShell()) {
    throw new Error("Launch at login is only available in the desktop app");
  }
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  if (enabled) await enable();
  else await disable();
}
