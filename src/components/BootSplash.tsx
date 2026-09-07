import { Loader2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";

export function BootSplash({ message = "Starting sidecar…" }: { message?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-7 overflow-hidden bg-background">
      <LogoMark size={88} alt="Deckhand" />
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Deckhand</h1>
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={message} />
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      </div>
    </div>
  );
}
