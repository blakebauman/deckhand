import { Toaster as SonnerToaster } from "@/components/ui/sonner";

/** Toast host (Sonner). Top-right clears the status dock and icon rail. */
export function Toaster() {
  return <SonnerToaster position="top-right" richColors closeButton />;
}

export { toast } from "@/lib/toast";
