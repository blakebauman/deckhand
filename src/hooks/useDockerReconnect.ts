import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toaster";

/** Rebuild attach client + invalidate docker-facing queries. */
export function useDockerReconnect() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const reconnect = async () => {
    setPending(true);
    try {
      const res = await api.reconnectDocker();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["status"] }),
        qc.invalidateQueries({ queryKey: ["docker-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["docker-info"] }),
        qc.invalidateQueries({ queryKey: ["docker-contexts"] }),
        qc.invalidateQueries({ queryKey: ["containers"] }),
        qc.invalidateQueries({ queryKey: ["images"] }),
        qc.invalidateQueries({ queryKey: ["volumes"] }),
        qc.invalidateQueries({ queryKey: ["networks"] }),
        qc.invalidateQueries({ queryKey: ["compose-projects"] }),
        qc.invalidateQueries({ queryKey: ["builders"] }),
        qc.invalidateQueries({ queryKey: ["system-df"] }),
      ]);
      if (res.connected) {
        toast.success("Docker connected", {
          description: res.activeContext || res.host || "attach",
        });
      } else {
        toast.error("Still offline", {
          description: res.error || "Start the Docker engine, then retry",
        });
      }
      return res;
    } catch (e: any) {
      toast.error("Reconnect failed", { description: e?.message || String(e) });
      await qc.invalidateQueries({ queryKey: ["status"] });
      return null;
    } finally {
      setPending(false);
    }
  };

  return { reconnect, pending };
}
