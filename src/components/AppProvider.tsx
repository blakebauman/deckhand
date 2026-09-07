import { TooltipProvider } from "@/components/ui/tooltip";
import { useThemeSync } from "@/hooks/useThemeSync";
import type { ReactNode } from "react";

/** App chrome: theme sync + tooltip context. */
export function AppProvider({ children }: { children: ReactNode }) {
  useThemeSync();
  return <TooltipProvider delay={300}>{children}</TooltipProvider>;
}
