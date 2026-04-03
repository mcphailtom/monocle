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
import type { CommentType, ReviewComment } from "../types";

const COMMENT_TYPES: {
  value: CommentType;
  label: string;
  className: string;
}[] = [
  { value: "issue", label: "Issue", className: "text-comment-issue border-comment-issue/40" },
  { value: "suggestion", label: "Suggestion", className: "text-comment-suggest border-comment-suggest/40" },
  { value: "note", label: "Note", className: "text-comment-note border-comment-note/40" },
  { value: "praise", label: "Praise", className: "text-comment-praise border-comment-praise/40" },
];

interface CommentEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (type: CommentType, body: string) => void;
  /** If editing an existing comment */
  editingComment?: ReviewComment | null;
  /** Pre-set comment type (e.g. for suggestion mode) */
  initialType?: CommentType;
  /** Pre-fill body text (e.g. suggestion block template) */
  initialBody?: string;
  /** Target info for display */
  targetLabel: string;
  lineStart: number;
  lineEnd: number;
}

export function CommentEditor({
  open,
  onClose,
  onSave,
  editingComment,
  initialType,
  initialBody,
  targetLabel,
  lineStart,
  lineEnd,
}: CommentEditorProps) {
  const [commentType, setCommentType] = useState<CommentType>(
    editingComment?.Type ?? "issue",
  );
  const [body, setBody] = useState(editingComment?.Body ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCommentType(editingComment?.Type ?? initialType ?? "issue");
      setBody(editingComment?.Body ?? initialBody ?? "");
      // Focus textarea after dialog animation
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          // For suggestion template, place cursor inside the code block
          if (initialBody && !editingComment) {
            const cursorPos = initialBody.indexOf("\n\n```");
            if (cursorPos >= 0) {
              ta.setSelectionRange(cursorPos + 1, cursorPos + 1);
            }
          }
        }
      }, 100);
    }
  }, [open, editingComment, initialType, initialBody]);

  const handleSave = useCallback(() => {
    if (!body.trim()) return;
    onSave(commentType, body.trim());
    onClose();
  }, [commentType, body, onSave, onClose]);

  const cycleType = useCallback(() => {
    setCommentType((current) => {
      const idx = COMMENT_TYPES.findIndex((t) => t.value === current);
      return COMMENT_TYPES[(idx + 1) % COMMENT_TYPES.length].value;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        cycleType();
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [cycleType, handleSave, onClose],
  );

  const lineLabel =
    lineStart === lineEnd || lineEnd === 0
      ? `Line ${lineStart}`
      : `Lines ${lineStart}-${lineEnd}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>
            {editingComment ? "Edit Comment" : "Add Comment"}
          </DialogTitle>
          <div className="text-xs text-muted-foreground font-mono">
            {targetLabel} &middot; {lineLabel}
          </div>
        </DialogHeader>

        {/* Comment type selector */}
        <div className="flex gap-1">
          {COMMENT_TYPES.map((ct) => (
            <button
              key={ct.value}
              className={`px-3 py-1 text-xs rounded border ${
                commentType === ct.value
                  ? `${ct.className} bg-secondary`
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={() => setCommentType(ct.value)}
            >
              {ct.label}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground self-center ml-2">
            Tab to cycle
          </span>
        </div>

        {/* Body */}
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your comment..."
          className="min-h-[120px] text-sm"
        />

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] text-muted-foreground">
              Ctrl+Enter to save &middot; Esc to cancel
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!body.trim()}
              >
                {editingComment ? "Update" : "Add"} Comment
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
