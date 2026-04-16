import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { SessionSummary } from "../types";
import { humanizeAgo } from "../lib/time";

interface SessionPickerProps {
  open: boolean;
  sessions: SessionSummary[];
  onResume: (sessionID: string) => void;
  onNew: () => void;
}

export function SessionPicker({ open, sessions, onResume, onNew }: SessionPickerProps) {
  // cursor 0 = "New session", 1..N = sessions
  const [cursor, setCursor] = useState(1);
  const maxCursor = sessions.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, maxCursor));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (cursor === 0) {
          onNew();
        } else {
          const s = sessions[cursor - 1];
          if (s) onResume(s.ID);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onNew();
      }
    },
    [cursor, maxCursor, onNew, onResume, sessions],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onNew()}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Resume Session</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-0.5">
            {/* New session option */}
            <button
              className={`w-full text-left px-2 py-2 rounded text-xs ${
                cursor === 0
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={() => onNew()}
              onMouseEnter={() => setCursor(0)}
            >
              <span className="font-mono">+ New session</span>
            </button>

            {sessions.map((s, i) => {
              const isCursor = i + 1 === cursor;
              const id = s.ID.length > 8 ? s.ID.slice(0, 8) : s.ID;
              return (
                <button
                  key={s.ID}
                  className={`w-full text-left px-2 py-2 rounded text-xs flex gap-2 items-baseline ${
                    isCursor
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => onResume(s.ID)}
                  onMouseEnter={() => setCursor(i + 1)}
                >
                  <span
                    className={`font-mono shrink-0 ${isCursor ? "" : "text-ctp-yellow"}`}
                  >
                    {id}
                  </span>
                  <span className="truncate">
                    R{s.ReviewRound} · {s.FileCount} file{s.FileCount !== 1 ? "s" : ""} ·{" "}
                    {s.CommentCount} comment{s.CommentCount !== 1 ? "s" : ""} ·{" "}
                    {humanizeAgo(s.UpdatedAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center relative z-10 bg-muted">
          <span className="text-[10px] text-muted-foreground sm:mr-auto">
            Enter to select &middot; j/k to navigate &middot; Esc for new session
          </span>
          <Button variant="outline" size="sm" onClick={onNew}>
            New Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
