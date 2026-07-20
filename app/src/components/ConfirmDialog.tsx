import { AlertDialog, DialogContainer } from "@react-spectrum/s2";

/** Confirm dialog — Spectrum AlertDialog, no dismiss X. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <DialogContainer onDismiss={() => onOpenChange(false)}>
      {open ? (
        <AlertDialog
          title={title}
          variant={destructive ? "destructive" : "confirmation"}
          primaryActionLabel={confirmLabel}
          cancelLabel={cancelLabel}
          isPrimaryActionDisabled={loading}
          onCancel={() => onOpenChange(false)}
          onPrimaryAction={() => {
            void Promise.resolve(onConfirm())
              .then(() => onOpenChange(false))
              .catch(() => {
                /* keep open — callers toast errors */
              });
          }}
        >
          {description}
        </AlertDialog>
      ) : null}
    </DialogContainer>
  );
}
