import { Provider } from "@react-spectrum/s2";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useThemeSync } from "@/hooks/useThemeSync";

export function SpectrumProvider({ children }: { children: ReactNode }) {
  const colorScheme = useThemeSync();
  const router = useRouter();

  return (
    <Provider
      background="base"
      locale="en-US"
      colorScheme={colorScheme}
      router={{
        navigate: (path, opts) => {
          void router.navigate({ to: path, ...(opts ?? {}) });
        },
        useHref: (href) => {
          if (typeof href === "string") return href;
          return String(href);
        },
      }}
    >
      {children}
    </Provider>
  );
}
