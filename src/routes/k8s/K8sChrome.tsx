import { useQuery } from "@tanstack/react-query";
import { HelpHint } from "@/components/HelpHint";
import { toast } from "@/components/Toaster";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useUIStore } from "@/stores/uiStore";

export function K8sChrome({ children }: { children: React.ReactNode }) {
  const namespace = useUIStore((s) => s.namespace);
  const setNamespace = useUIStore((s) => s.setNamespace);
  const contexts = useQuery({ queryKey: ["k8s-contexts"], queryFn: api.k8sContexts });
  const namespaces = useQuery({ queryKey: ["namespaces"], queryFn: api.namespaces });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3">
        <Select
          value={contexts.data?.current ?? undefined}
          onValueChange={(v) => {
            if (!v) return;
            void api
              .switchKubeContext(v)
              .then(() => {
                contexts.refetch();
                toast.success("Context switched", { description: v });
              })
              .catch((e: any) => toast.error("Context switch failed", { description: e?.message }));
          }}
        >
          <SelectTrigger aria-label="Kubernetes context" className="min-w-[160px] max-w-[256px]">
            <SelectValue placeholder="Context" />
          </SelectTrigger>
          <SelectContent>
            {(contexts.data?.contexts || []).map((c: any) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={namespace} onValueChange={(key) => key && setNamespace(key)}>
          <SelectTrigger aria-label="Kubernetes namespace" className="min-w-[128px] max-w-[192px]">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            {(namespaces.data || ["default"]).map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <HelpHint label="Context and namespace apply to every Kubernetes view in this mode" />
      </div>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}
