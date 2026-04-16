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
import type { LogEntry, ReviewSnapshot } from "../types";
import { humanizeAgo } from "../lib/time";

interface BaseRefPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: string) => void;
  onAutoSelect: () => void;
  onSelectSnapshot: (snapshotID: number) => void;
}

export function BaseRefPicker({
  open,
  onClose,
  onSelect,
  onAutoSelect,
  onSelectSnapshot,
}: BaseRefPickerProps) {
  const [commits, setCommits] = useState<LogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<ReviewSnapshot[]>([]);
  const [customRef, setCustomRef] = useState("");
  const [cursor, setCursor] = useState(0);
  const [autoActive, setAutoActive] = useState(false);
  const [activeSnapshotID, setActiveSnapshotID] = useState<number | null>(null);
  const [selectedRef, setSelectedRef] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Cursor layout: 0 = "Latest Changes", 1..S = snapshots, S+1..S+C = commits.
  const commitStart = 1 + snapshots.length;
  const maxCursor = commitStart + commits.length - 1;

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.recentCommits(20),
      api.isAutoAdvanceRef(),
      api.selectedBaseRef(),
      api.getSnapshots(),
      api.getActiveSnapshot(),
    ]).then(([c, isAuto, ref, snaps, activeSnap]) => {
      const commitList = c ?? [];
      const snapList = snaps ?? [];
      setCommits(commitList);
      setSnapshots(snapList);
      setAutoActive(isAuto);
      setActiveSnapshotID(activeSnap?.ID ?? null);
      setSelectedRef(ref);
      setCustomRef("");

      // Pre-select the currently active entry.
      if (activeSnap) {
        const idx = snapList.findIndex((s) => s.ID === activeSnap.ID);
        setCursor(idx >= 0 ? 1 + idx : 0);
      } else if (isAuto) {
        setCursor(0);
      } else if (ref) {
        const idx = commitList.findIndex(
          (commit) => commit.hash === ref || commit.hash.startsWith(ref.slice(0, 7)),
        );
        setCursor(idx >= 0 ? 1 + snapList.length + idx : 0);
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

  const handleSelectSnapshot = useCallback(
    (snapshotID: number) => {
      onSelectSnapshot(snapshotID);
      onClose();
    },
    [onSelectSnapshot, onClose],
  );

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
        } else if (cursor >= 1 && cursor <= snapshots.length) {
          const snap = snapshots[cursor - 1];
          if (snap) handleSelectSnapshot(snap.ID);
        } else {
          const commit = commits[cursor - commitStart];
          if (commit) handleSelectCommit(commit.hash);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [
      commits,
      snapshots,
      commitStart,
      cursor,
      maxCursor,
      customRef,
      handleSelectCommit,
      handleSelectAuto,
      handleSelectSnapshot,
      onClose,
    ],
  );

  const isSelectedCommit = (commitHash: string) =>
    !autoActive &&
    activeSnapshotID === null &&
    selectedRef &&
    (commitHash === selectedRef || commitHash.startsWith(selectedRef.slice(0, 7)));

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

        <ScrollArea className="max-h-[40vh]">
          <div className="space-y-0.5">
            {/* Latest Changes (auto follow HEAD) */}
            <button
              className={`w-full text-left px-2 py-1 rounded text-xs ${
                cursor === 0
                  ? "bg-primary text-primary-foreground"
                  : autoActive && activeSnapshotID === null
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
              }`}
              onClick={handleSelectAuto}
              onMouseEnter={() => setCursor(0)}
            >
              Latest Changes{autoActive && activeSnapshotID === null ? " ✓" : ""}
            </button>

            {/* Snapshots section (if any) */}
            {snapshots.length > 0 && (
              <>
                <div className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Since Review
                </div>
                {snapshots.map((snap, i) => {
                  const pos = 1 + i;
                  const isCursor = pos === cursor;
                  const isActive = activeSnapshotID === snap.ID;
                  return (
                    <button
                      key={snap.ID}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex gap-2 items-baseline ${
                        isCursor
                          ? "bg-primary text-primary-foreground"
                          : isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-ctp-sky hover:bg-secondary/50"
                      }`}
                      onClick={() => handleSelectSnapshot(snap.ID)}
                      onMouseEnter={() => setCursor(pos)}
                    >
                      <span className="shrink-0 font-mono">
                        Round {snap.ReviewRound}
                      </span>
                      <span className="truncate">({humanizeAgo(snap.CreatedAt)})</span>
                      {isActive && !isCursor && <span className="ml-auto shrink-0">✓</span>}
                    </button>
                  );
                })}
              </>
            )}

            {/* Commits section header (visually separate when snapshots present) */}
            {snapshots.length > 0 && commits.length > 0 && (
              <div className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Commits
              </div>
            )}

            {/* Commit entries */}
            {commits.map((commit, i) => {
              const pos = commitStart + i;
              const isCursor = pos === cursor;
              const isCurrent = isSelectedCommit(commit.hash);
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
                  onMouseEnter={() => setCursor(pos)}
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

        <DialogFooter className="items-center relative z-10 bg-muted">
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
