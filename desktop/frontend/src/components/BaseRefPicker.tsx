import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { api } from "../api";
import type { LogEntry } from "../types";

interface BaseRefPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: string) => void;
  onAutoSelect: () => void;
}

export function BaseRefPicker({ open, onClose, onSelect, onAutoSelect }: BaseRefPickerProps) {
  const [commits, setCommits] = useState<LogEntry[]>([]);
  const [customRef, setCustomRef] = useState("");
  const [cursor, setCursor] = useState(0);
  const [autoActive, setAutoActive] = useState(false);
  const [selectedRef, setSelectedRef] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // cursor 0 = Auto option, 1..N = commits
  const maxCursor = commits.length;

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.recentCommits(20),
      api.isAutoAdvanceRef(),
      api.selectedBaseRef(),
    ]).then(([c, isAuto, ref]) => {
      const commitList = c ?? [];
      setCommits(commitList);
      setAutoActive(isAuto);
      setSelectedRef(ref);
      setCustomRef("");
      // Pre-select the current ref in the list
      if (isAuto) {
        setCursor(0);
      } else if (ref) {
        const idx = commitList.findIndex(
          (commit) => commit.hash === ref || commit.hash.startsWith(ref.slice(0, 7)),
        );
        setCursor(idx >= 0 ? idx + 1 : 0);
      } else {
        setCursor(0);
      }
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSelectCommit = useCallback(
    (ref: string) => {
      onSelect(ref);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleSelectAuto = useCallback(() => {
    onAutoSelect();
    onClose();
  }, [onAutoSelect, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "j" && !customRef)) {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, maxCursor));
      } else if (e.key === "ArrowUp" || (e.key === "k" && !customRef)) {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (customRef.trim()) {
          handleSelectCommit(customRef.trim());
        } else if (cursor === 0) {
          handleSelectAuto();
        } else {
          const commit = commits[cursor - 1];
          if (commit) handleSelectCommit(commit.hash);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [commits, cursor, maxCursor, customRef, handleSelectCommit, handleSelectAuto, onClose],
  );

  const isSelected = (commitHash: string) =>
    !autoActive && selectedRef && (commitHash === selectedRef || commitHash.startsWith(selectedRef.slice(0, 7)));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Change Base Ref</DialogTitle>
        </DialogHeader>

        <Input
          ref={inputRef}
          value={customRef}
          onChange={(e) => setCustomRef(e.target.value)}
          placeholder="Enter branch, tag, or commit hash..."
          className="font-mono text-xs"
        />

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5">
            {/* Auto (follow HEAD) option */}
            <button
              className={`w-full text-left px-2 py-1 rounded text-xs ${
                cursor === 0
                  ? "bg-primary text-primary-foreground"
                  : autoActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={handleSelectAuto}
              onMouseEnter={() => setCursor(0)}
            >
              Auto (follow HEAD){autoActive ? " ✓" : ""}
            </button>

            {/* Commit entries */}
            {commits.map((commit, i) => {
              const isCursor = i + 1 === cursor;
              const isCurrent = isSelected(commit.hash);
              return (
                <button
                  key={commit.hash}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex gap-2 items-baseline ${
                    isCursor
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => handleSelectCommit(commit.hash)}
                  onMouseEnter={() => setCursor(i + 1)}
                >
                  <span className={`font-mono shrink-0 ${isCursor ? "" : "text-ctp-mauve"}`}>
                    {commit.hash.slice(0, 7)}
                  </span>
                  <span className="truncate">{commit.subject}</span>
                  {isCurrent && !isCursor && <span className="ml-auto shrink-0">✓</span>}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center">
          <span className="text-[10px] text-muted-foreground sm:mr-auto">
            Enter to select &middot; j/k to navigate &middot; Esc to cancel
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
