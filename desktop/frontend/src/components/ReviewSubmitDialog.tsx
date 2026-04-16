import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { api } from "../api";
import type { ReviewSummary, SubmitAction } from "../types";

interface ReviewSubmitDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (action: SubmitAction, body: string) => void;
  onCopyToClipboard?: (action: SubmitAction, body: string) => void;
  summary: ReviewSummary | null;
}

const ACTIONS: { value: SubmitAction; label: string; className: string }[] = [
  {
    value: "approve",
    label: "Approve",
    className: "text-ctp-green border-ctp-green/40",
  },
  {
    value: "request_changes",
    label: "Request Changes",
    className: "text-ctp-yellow border-ctp-yellow/40",
  },
];

export function ReviewSubmitDialog({
  open,
  onClose,
  onSubmit,
  onCopyToClipboard,
  summary,
}: ReviewSubmitDialogProps) {
  const [action, setAction] = useState<SubmitAction>("request_changes");
  const [body, setBody] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // Default to request_changes if there are issue comments
      const hasIssues = (summary?.IssueCt ?? 0) > 0;
      setAction(hasIssues ? "request_changes" : "approve");
      setBody("");
    }
  }, [open, summary]);

  const handleSubmit = useCallback(() => {
    onSubmit(action, body.trim());
    onClose();
  }, [action, body, onSubmit, onClose]);

  const handleCopy = useCallback(() => {
    onCopyToClipboard?.(action, body.trim());
    onClose();
  }, [action, body, onCopyToClipboard, onClose]);

  const openInExternalEditor = useCallback(async () => {
    setEditorError(null);
    try {
      const edited = await api.openExternalEditor(body);
      setBody(edited.replace(/\n$/, ""));
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setEditorError(msg);
    }
  }, [body]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCopy();
      }
      if (e.key === "g" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void openInExternalEditor();
      }
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setAction((a) => (a === "approve" ? "request_changes" : "approve"));
      }
    },
    [handleSubmit, handleCopy, openInExternalEditor],
  );

  const totalComments =
    (summary?.IssueCt ?? 0) +
    (summary?.SuggestionCt ?? 0) +
    (summary?.NoteCt ?? 0) +
    (summary?.PraiseCt ?? 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Submit Review</DialogTitle>
        </DialogHeader>

        {/* Comment summary */}
        <div className="text-xs space-y-1">
          <div className="text-muted-foreground">
            {totalComments} comment{totalComments !== 1 ? "s" : ""}
          </div>
          <div className="flex gap-3">
            {(summary?.IssueCt ?? 0) > 0 && (
              <span className="text-comment-issue">
                {summary!.IssueCt} issue{summary!.IssueCt !== 1 ? "s" : ""}
              </span>
            )}
            {(summary?.SuggestionCt ?? 0) > 0 && (
              <span className="text-comment-suggest">
                {summary!.SuggestionCt} suggestion
                {summary!.SuggestionCt !== 1 ? "s" : ""}
              </span>
            )}
            {(summary?.NoteCt ?? 0) > 0 && (
              <span className="text-comment-note">
                {summary!.NoteCt} note{summary!.NoteCt !== 1 ? "s" : ""}
              </span>
            )}
            {(summary?.PraiseCt ?? 0) > 0 && (
              <span className="text-comment-praise">
                {summary!.PraiseCt} praise
              </span>
            )}
          </div>
        </div>

        {/* Action selector */}
        <div className="flex gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              className={`flex-1 px-3 py-2 text-xs rounded border ${
                action === a.value
                  ? `${a.className} bg-secondary`
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={() => setAction(a.value)}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Optional body */}
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Additional comments (optional)..."
          className="min-h-[80px] text-sm font-mono"
        />

        {editorError && (
          <div className="text-xs text-destructive">{editorError}</div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] text-muted-foreground">
              Tab to toggle
              <span className="mx-2">&middot;</span>
              {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+"}Enter to submit
              <span className="mx-2">&middot;</span>
              {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+"}Y to copy
              <span className="mx-2">&middot;</span>
              {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl+"}G for editor
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openInExternalEditor()}
                title="Open in $VISUAL/$EDITOR"
              >
                Editor
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                Submit
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
