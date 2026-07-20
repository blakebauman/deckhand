import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "@react-spectrum/s2";
import "@react-spectrum/s2/page.css";
import { useEffect, useState } from "react";
import { AppRouter } from "@/router";
import { BootSplash } from "@/components/BootSplash";
import { api, setApiBaseUrl } from "@/lib/api";
import { isTauriShell } from "@/lib/platform";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const BROWSER_SIDECAR =
  (import.meta as any).env?.VITE_SIDECAR_URL || "http://127.0.0.1:7420";

async function invokeSidecarUrl(): Promise<string | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const url = await Promise.race([
      invoke<string>("sidecar_url"),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("sidecar_url timeout")), 2500),
      ),
    ]);
    return url?.trim() || null;
  } catch {
    return null;
  }
}

/** In Tauri, keep asking until we get a URL — never silently stick to a stale :7420. */
async function resolveSidecarUrl(): Promise<string> {
  if (!isTauriShell()) return BROWSER_SIDECAR;

  for (let i = 0; i < 40; i++) {
    const url = await invokeSidecarUrl();
    if (url) return url;
    await new Promise((r) => setTimeout(r, 250));
  }
  return BROWSER_SIDECAR;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Connecting to sidecar…");

  useEffect(() => {
    let cancelled = false;
    let url = BROWSER_SIDECAR;

    (async () => {
      url = await resolveSidecarUrl();
      setApiBaseUrl(url);
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          await api.health();
          if (!cancelled) setReady(true);
          return;
        } catch {
          if (isTauriShell() && i > 0 && i % 4 === 0) {
            const next = await invokeSidecarUrl();
            if (next && next !== url) {
              url = next;
              setApiBaseUrl(url);
            }
          }
          setMessage(`Waiting for sidecar (${url})…`);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      if (!cancelled) {
        setMessage("Sidecar unavailable — retrying in background");
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // After forced ready, keep probing so a late sidecar still attaches.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let url = BROWSER_SIDECAR;

    const tick = async () => {
      if (cancelled) return;
      try {
        if (isTauriShell()) {
          const next = await invokeSidecarUrl();
          if (next && next !== url) {
            url = next;
            setApiBaseUrl(url);
          }
        }
        await api.health();
        await queryClient.invalidateQueries({ queryKey: ["status"] });
      } catch {
        /* keep looping */
      }
    };

    void (async () => {
      url = await resolveSidecarUrl();
      setApiBaseUrl(url);
    })();

    const id = window.setInterval(() => void tick(), 8000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ready]);

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
