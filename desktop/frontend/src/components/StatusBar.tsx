import type { ReviewSession } from "../types";

interface StatusBarProps {
  session: ReviewSession | null;
  subscriberCount: number;
  connectionMode: string;
  feedbackStatus: string;
  selectedFile: string;
}

export function StatusBar({
  session,
  subscriberCount,
  connectionMode,
  feedbackStatus,
  selectedFile,
}: StatusBarProps) {
  const isConnected = subscriberCount > 0 || connectionMode === "queue";
  const fileCount = session?.ChangedFiles?.length ?? 0;
  const contentCount = session?.ContentItems?.length ?? 0;
  const commentCount = session?.Comments?.length ?? 0;

  return (
    <footer className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="text-foreground font-mono">
          {selectedFile || "No file selected"}
        </span>
        {feedbackStatus && feedbackStatus !== "none" && (
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
        <span
          className={
            isConnected ? "text-ctp-green" : "text-muted-foreground"
          }
        >
          {isConnected
            ? "Agent connected"
            : "No agent"}
        </span>
        <span className="text-muted-foreground font-mono">?:help</span>
      </div>
    </footer>
  );
}
