import { ToastContainer } from "@react-spectrum/s2";

/**
 * Spectrum toast host.
 * Top-end clears the status dock (bottom) and the icon rail (start).
 */
export function Toaster() {
  return <ToastContainer placement="top end" />;
}

export { toast } from "@/lib/toast";
