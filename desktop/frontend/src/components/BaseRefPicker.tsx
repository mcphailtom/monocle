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
}

export function BaseRefPicker({ open, onClose, onSelect }: BaseRefPickerProps) {
  const [commits, setCommits] = useState<LogEntry[]>([]);
  const [currentRef, setCurrentRef] = useState("");
  const [customRef, setCustomRef] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.recentCommits(20),
      api.selectedBaseRef(),
    ]).then(([c, ref]) => {
      setCommits(c ?? []);
      setCurrentRef(ref);
      setCustomRef("");
      setCursor(0);
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSelect = useCallback(
    (ref: string) => {
      onSelect(ref);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "j" && !customRef)) {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, commits.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && !customRef)) {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (customRef.trim()) {
          handleSelect(customRef.trim());
        } else if (commits[cursor]) {
          handleSelect(commits[cursor].hash);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [commits, cursor, customRef, handleSelect, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Change Base Ref</DialogTitle>
          {currentRef && (
            <p className="text-xs text-muted-foreground font-mono">
              Current: {currentRef}
            </p>
          )}
        </DialogHeader>

        <Input
          ref={inputRef}
          value={customRef}
          onChange={(e) => setCustomRef(e.target.value)}
          placeholder="Enter branch, tag, or commit hash..."
          className="font-mono text-xs"
        />

        <ScrollArea className="max-h-[40vh]">
          <div className="space-y-0.5">
            {commits.map((commit, i) => (
              <button
                key={commit.hash}
                className={`w-full text-left px-2 py-1 rounded text-xs flex gap-2 items-baseline ${
                  i === cursor
                    ? "bg-primary/20 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
                onClick={() => handleSelect(commit.hash)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="font-mono text-ctp-mauve shrink-0">
                  {commit.hash.slice(0, 7)}
                </span>
                <span className="truncate">{commit.subject}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <span className="text-[10px] text-muted-foreground">
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
