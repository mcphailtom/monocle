import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { api } from "../api";
import type { ContentVersion } from "../types";
import { humanizeAgo } from "../lib/time";

interface VersionPickerProps {
  open: boolean;
  contentID: string;
  currentFromVersion: number | null;
  onClose: () => void;
  onSelect: (fromVersion: number, toVersion: number) => void;
}

export function VersionPicker({
  open,
  contentID,
  currentFromVersion,
  onClose,
  onSelect,
}: VersionPickerProps) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [cursor, setCursor] = useState(1);

  useEffect(() => {
    if (!open || !contentID) return;
    api
      .getContentVersions(contentID)
      .then((vs) => {
        // Newest first; latest version (index 0) is not selectable.
        const list = vs ?? [];
        setVersions(list);
        // Pre-select currentFromVersion if set, else v1 (oldest, index = len-1).
        if (currentFromVersion != null) {
          const idx = list.findIndex((v) => v.Version === currentFromVersion);
          setCursor(idx >= 1 ? idx : Math.max(1, list.length - 1));
        } else {
          setCursor(Math.max(1, list.length - 1));
        }
      })
      .catch(() => setVersions([]));
  }, [open, contentID, currentFromVersion]);

  const latest = versions[0];
  const maxCursor = versions.length - 1;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, maxCursor));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        // Clamp to 1 (latest is not selectable)
        setCursor((c) => Math.max(c - 1, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (cursor > 0 && cursor < versions.length && latest) {
          const picked = versions[cursor];
          onSelect(picked.Version, latest.Version);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [cursor, maxCursor, versions, latest, onSelect, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Select Base Version</DialogTitle>
          <div className="text-[10px] text-muted-foreground">
            Diff from selected version to latest
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-0.5">
            {versions.map((v, i) => {
              const isLatest = i === 0;
              const isCursor = i === cursor && !isLatest;
              const isCurrent = v.Version === currentFromVersion;
              return (
                <button
                  key={v.Version}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex gap-2 items-baseline ${
                    isLatest
                      ? "opacity-50 cursor-default"
                      : isCursor
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => {
                    if (isLatest || !latest) return;
                    onSelect(v.Version, latest.Version);
                    onClose();
                  }}
                  onMouseEnter={() => {
                    if (!isLatest) setCursor(i);
                  }}
                  disabled={isLatest}
                >
                  <span
                    className={`font-mono shrink-0 w-8 ${
                      isCursor ? "" : isLatest ? "" : "text-ctp-yellow"
                    }`}
                  >
                    v{v.Version}
                  </span>
                  <span className="shrink-0 w-20 text-[10px]">
                    {humanizeAgo(v.CreatedAt)}
                  </span>
                  <span className="truncate">
                    {v.Title}
                    {isLatest && " (current)"}
                  </span>
                  {isCurrent && !isCursor && (
                    <span className="ml-auto shrink-0">✓</span>
                  )}
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
