import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useThemeSync } from "@/hooks/useThemeSync";

/** App chrome: theme sync + tooltip context. */
export function AppProvider({ children }: { children: ReactNode }) {
  useThemeSync();
  return <TooltipProvider delay={300}>{children}</TooltipProvider>;
}
