import { useQuery } from "@tanstack/react-query";
import { Picker, PickerItem } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { HelpHint } from "@/components/HelpHint";
import { toast } from "@/components/Toaster";
import { useUIStore } from "@/stores/uiStore";

export function K8sChrome({ children }: { children: React.ReactNode }) {
  const namespace = useUIStore((s) => s.namespace);
  const setNamespace = useUIStore((s) => s.setNamespace);
  const contexts = useQuery({ queryKey: ["k8s-contexts"], queryFn: api.k8sContexts });
  const namespaces = useQuery({ queryKey: ["namespaces"], queryFn: api.namespaces });

  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        height: "full",
        minHeight: 0,
      })}
    >
      <div
        className={style({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexShrink: 0,
        })}
      >
        <Picker
          aria-label="Kubernetes context"
          size="S"
          placeholder="Context"
          styles={style({ minWidth: 160, maxWidth: 256 })}
          value={contexts.data?.current ?? null}
          onChange={(key) => {
            const v = String(key);
            void api
              .useContext(v)
              .then(() => {
                contexts.refetch();
                toast.success("Context switched", { description: v });
              })
              .catch((e: any) => toast.error("Context switch failed", { description: e?.message }));
          }}
        >
          {(contexts.data?.contexts || []).map((c: any) => (
            <PickerItem key={c.name} id={c.name}>
              {c.name}
            </PickerItem>
          ))}
        </Picker>
        <Picker
          aria-label="Kubernetes namespace"
          size="S"
          placeholder="Namespace"
          styles={style({ minWidth: 128, maxWidth: 192 })}
          value={namespace}
          onChange={(key) => setNamespace(String(key))}
        >
          {(namespaces.data || ["default"]).map((ns) => (
            <PickerItem key={ns} id={ns}>
              {ns}
            </PickerItem>
          ))}
        </Picker>
        <HelpHint label="Context and namespace apply to every Kubernetes view in this mode" />
      </div>
      <div className={style({ flexGrow: 1, minHeight: 0, minWidth: 0 })}>{children}</div>
    </div>
  );
}
