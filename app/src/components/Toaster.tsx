import { ToastContainer } from "@react-spectrum/s2";

/** Spectrum toast host. */
export function Toaster() {
  return <ToastContainer placement="bottom end" />;
}

export { toast } from "@/lib/toast";
