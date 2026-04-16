import type { ReviewSession, ReviewSnapshot } from "../types";
import { humanizeAgo } from "../lib/time";

type ViewMode = "unified" | "split" | "file";

interface StatusBarProps {
  session: ReviewSession | null;
  feedbackStatus: string;
  pauseStatus: string;
  selectedFile: string;
  baseRef: string;
  activeSnapshot: ReviewSnapshot | null;
  versionDiff: { from: number; to: number } | null;
  viewMode: ViewMode;
  selectedContentId: string;
  nonGitMode: boolean;
}

function diffStyleBadge(
  viewMode: ViewMode,
  selectedContentId: string,
  versionDiff: { from: number; to: number } | null,
): string | null {
  // Show a version-diff badge when diffing between artifact versions.
  if (versionDiff) {
    const base =
      viewMode === "split" ? "SPLIT" : viewMode === "file" ? "FILE" : "DIFF";
    return `[v${versionDiff.from}→v${versionDiff.to} ${base}]`;
  }
  // For content items, always show the DIFF/SPLIT indicator since that's the
  // normal rendering mode.
  if (selectedContentId && viewMode !== "file") {
    return viewMode === "split" ? "[SPLIT]" : "[DIFF]";
  }
  // For files, only surface non-default modes.
  if (viewMode === "split") return "[SPLIT]";
  if (viewMode === "file") return "[FILE]";
  return null;
}

export function StatusBar({
  session,
  feedbackStatus,
  pauseStatus,
  selectedFile,
  baseRef,
  activeSnapshot,
  versionDiff,
  viewMode,
  selectedContentId,
  nonGitMode,
}: StatusBarProps) {
  const fileCount = session?.ChangedFiles?.length ?? 0;
  const contentCount = session?.ContentItems?.length ?? 0;
  const commentCount = session?.Comments?.length ?? 0;

  // Prefer snapshot display over the raw ref when tracking "Since Review".
  // In directory mode there is no git ref to show.
  let refDisplay = "";
  if (nonGitMode) {
    refDisplay = "directory mode";
  } else if (activeSnapshot) {
    refDisplay = `R${activeSnapshot.ReviewRound} (${humanizeAgo(activeSnapshot.CreatedAt)})`;
  } else if (baseRef) {
    refDisplay = `ref:${baseRef.slice(0, 8)}`;
  }

  const badge = diffStyleBadge(viewMode, selectedContentId, versionDiff);
  const paused = pauseStatus === "paused";

  return (
    <footer className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="text-foreground font-mono">
          {selectedFile || "No file selected"}
        </span>
        {badge && (
          <span className="text-ctp-mauve font-mono font-semibold">
            {badge}
          </span>
        )}
        {paused && (
          <span className="text-ctp-yellow font-mono">
            ● Waiting for Review
          </span>
        )}
        {feedbackStatus && feedbackStatus !== "none" && !paused && (
          <span className="text-ctp-yellow">{feedbackStatus}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {commentCount > 0 && (
          <span>
            {commentCount} comment{commentCount !== 1 ? "s" : ""}
          </span>
        )}
        <span>
          {fileCount} file{fileCount !== 1 ? "s" : ""}
          {contentCount > 0 && `, ${contentCount} item${contentCount !== 1 ? "s" : ""}`}
        </span>
        {refDisplay && (
          <span className={activeSnapshot ? "text-ctp-sky" : "font-mono"}>
            {refDisplay}
          </span>
        )}
        <span className="text-muted-foreground font-mono">?:help</span>
      </div>
    </footer>
  );
}
