import { ToastQueue } from "@react-spectrum/s2";

type ToastOpts = { description?: string };

function format(message: string, opts?: ToastOpts) {
  if (opts?.description) return `${message} — ${opts.description}`;
  return message;
}

/** App toast API backed by Spectrum ToastQueue. */
export const toast = {
  success(message: string, opts?: ToastOpts) {
    return ToastQueue.positive(format(message, opts));
  },
  error(message: string, opts?: ToastOpts) {
    return ToastQueue.negative(format(message, opts));
  },
  info(message: string, opts?: ToastOpts) {
    return ToastQueue.info(format(message, opts));
  },
  message(message: string, opts?: ToastOpts) {
    return ToastQueue.neutral(format(message, opts));
  },
};
