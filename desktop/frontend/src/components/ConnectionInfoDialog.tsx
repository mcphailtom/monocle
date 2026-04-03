import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { api } from "../api";

interface ConnectionInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectionInfoDialog({ open, onClose }: ConnectionInfoDialogProps) {
  const [socketPath, setSocketPath] = useState("");
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.getSocketPath(),
      api.getSubscriberCount(),
      api.getFeedbackStatus(),
      api.getQueuedCount(),
    ]).then(([path, count, status, queued]) => {
      setSocketPath(path);
      setSubscriberCount(count);
      setFeedbackStatus(status);
      setQueuedCount(queued);
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connection Info</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Socket</span>
            <span className="font-mono text-xs truncate max-w-[300px]">{socketPath || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subscribers</span>
            <span className={subscriberCount > 0 ? "text-ctp-green" : "text-muted-foreground"}>
              {subscriberCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Agent</span>
            <span className={subscriberCount > 0 ? "text-ctp-green" : "text-ctp-yellow"}>
              {subscriberCount > 0 ? "Connected" : "Not connected"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Feedback status</span>
            <span>{feedbackStatus || "idle"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Queued reviews</span>
            <span>{queuedCount}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
