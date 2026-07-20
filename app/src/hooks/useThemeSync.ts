import { useEffect, useMemo } from "react";
import { useUIStore, type ThemeMode } from "@/stores/uiStore";

type ColorScheme = "light" | "dark";

function resolveScheme(theme: ThemeMode): ColorScheme | undefined {
  if (theme === "system") return undefined;
  return theme;
}

/** Syncs html data-color-scheme for page.css and returns Provider colorScheme. */
export function useThemeSync(): ColorScheme | undefined {
  const theme = useUIStore((s) => s.theme);
  const colorScheme = useMemo(() => resolveScheme(theme), [theme]);

  useEffect(() => {
    const root = document.documentElement;

    const apply = (scheme: "light" | "dark" | null) => {
      if (scheme) {
        root.dataset.colorScheme = scheme;
      } else {
        delete root.dataset.colorScheme;
      }
      root.classList.remove("dark", "light");
    };

    if (theme === "system") {
      apply(null);
      return;
    }
    apply(theme);
  }, [theme]);

  return colorScheme;
}
