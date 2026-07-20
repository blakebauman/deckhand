import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "@react-spectrum/s2";
import { useEffect, useState } from "react";
import { AppRouter } from "@/router";
import { BootSplash } from "@/components/BootSplash";
import { api, setApiBaseUrl } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

async function resolveSidecarUrl(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const url = await Promise.race([
      invoke<string>("sidecar_url"),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("sidecar_url timeout")), 800),
      ),
    ]);
    if (url) return url;
  } catch {
    /* browser / no tauri / invoke unavailable */
  }
  return (import.meta as any).env?.VITE_SIDECAR_URL || "http://127.0.0.1:7420";
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Connecting to sidecar…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await resolveSidecarUrl();
      setApiBaseUrl(url);
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          await api.health();
          if (!cancelled) setReady(true);
          return;
        } catch {
          setMessage(`Waiting for sidecar (${url})…`);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (!cancelled) {
        setMessage("Sidecar unavailable — UI will retry in background");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <Provider background="base" locale="en-US">
        <BootSplash message={message} />
      </Provider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}
