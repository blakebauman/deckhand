import { useEffect } from "react";
import { useUIStore, type ThemeMode } from "@/stores/uiStore";

function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Syncs `.dark` / `data-color-scheme` on <html> for Tailwind dark mode. */
export function useThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const dark = resolveDark(theme);
      root.classList.toggle("dark", dark);
      root.dataset.colorScheme = dark ? "dark" : "light";
    };

    apply();

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}
