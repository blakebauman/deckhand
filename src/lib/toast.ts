import { toast as sonnerToast } from "sonner";

type ToastOpts = { description?: string };

/** App toast API backed by Sonner. */
export const toast = {
  success(message: string, opts?: ToastOpts) {
    return sonnerToast.success(message, opts);
  },
  error(message: string, opts?: ToastOpts) {
    return sonnerToast.error(message, opts);
  },
  info(message: string, opts?: ToastOpts) {
    return sonnerToast.info(message, opts);
  },
  message(message: string, opts?: ToastOpts) {
    return sonnerToast(message, opts);
  },
};
