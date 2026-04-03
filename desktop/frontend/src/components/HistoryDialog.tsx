import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { api } from "../api";
import type { ReviewSubmission } from "../types";

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HistoryDialog({ open, onClose }: HistoryDialogProps) {
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);

  useEffect(() => {
    if (!open) return;
    api.getSubmissions().then((subs) => setSubmissions(subs ?? []));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Submission History</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No submissions yet
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {submissions.map((sub) => (
                <div key={sub.ID} className="border border-border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium ${
                        sub.Action === "approve"
                          ? "text-ctp-green"
                          : "text-ctp-yellow"
                      }`}
                    >
                      {sub.Action === "approve" ? "Approved" : "Changes Requested"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Round {sub.ReviewRound}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {sub.CommentCount} comment{sub.CommentCount !== 1 ? "s" : ""}
                    {" \u00b7 "}
                    {new Date(sub.SubmittedAt).toLocaleString()}
                    {sub.DeliveredAt && (
                      <span className="text-ctp-green"> \u00b7 Delivered</span>
                    )}
                  </div>
                  {sub.FormattedReview && (
                    <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-auto bg-secondary/30 rounded p-2">
                      {sub.FormattedReview}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
