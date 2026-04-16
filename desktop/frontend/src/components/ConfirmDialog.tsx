import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  destructiveLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  destructiveLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || (e.key === "y" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape" || (e.key === "n" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        onCancel();
      }
    },
    [onConfirm, onCancel],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{message}</p>

        <DialogFooter className="items-center">
          <span className="text-[10px] text-muted-foreground sm:mr-auto">
            Enter or Y to confirm &middot; Esc or N to cancel
          </span>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} autoFocus>
            {destructiveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
