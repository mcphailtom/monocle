import { useMemo, useRef, useEffect } from "react";
import {
  Diff,
  Hunk,
  parseDiff,
  Decoration,
  getChangeKey,
  markEdits,
  tokenize,
} from "react-diff-view";
import type {
  HunkData,
  ViewType,
  DiffType,
  HunkTokens,
} from "react-diff-view";
import "react-diff-view/style/index.css";
import type { DiffResult, ReviewComment, CommentType } from "../types";

// --- Props ---

interface DiffViewProps {
  diff: DiffResult;
  comments: ReviewComment[];
  viewType: ViewType; // "unified" | "split"
  focused: boolean;
  onLineClick?: (lineNumber: number, side: "old" | "new") => void;
  onCommentClick?: (comment: ReviewComment) => void;
}

// --- Convert our DiffResult to unified diff string for parseDiff ---

function toUnifiedDiff(diff: DiffResult): string {
  const lines: string[] = [];
  lines.push(`--- a/${diff.Path}`);
  lines.push(`+++ b/${diff.Path}`);

  for (const hunk of diff.Hunks) {
    lines.push(
      `@@ -${hunk.OldStart},${hunk.OldCount} +${hunk.NewStart},${hunk.NewCount} @@ ${hunk.Header || ""}`,
    );
    for (const line of hunk.Lines) {
      switch (line.Kind) {
        case "added":
          lines.push(`+${line.Content}`);
          break;
        case "removed":
          lines.push(`-${line.Content}`);
          break;
        default:
          lines.push(` ${line.Content}`);
          break;
      }
    }
  }

  return lines.join("\n") + "\n";
}

// --- Comment widget ---

const COMMENT_TYPE_STYLES: Record<CommentType, { label: string; className: string }> = {
  issue: { label: "Issue", className: "bg-comment-issue/20 border-comment-issue/40 text-comment-issue" },
  suggestion: { label: "Suggestion", className: "bg-comment-suggest/20 border-comment-suggest/40 text-comment-suggest" },
  note: { label: "Note", className: "bg-comment-note/20 border-comment-note/40 text-comment-note" },
  praise: { label: "Praise", className: "bg-comment-praise/20 border-comment-praise/40 text-comment-praise" },
};

function CommentWidget({
  comments,
  onClick,
}: {
  comments: ReviewComment[];
  onClick?: (c: ReviewComment) => void;
}) {
  return (
    <div className="mx-2 my-1">
      {comments.map((comment) => {
        const style = COMMENT_TYPE_STYLES[comment.Type] ?? COMMENT_TYPE_STYLES.note;
        return (
          <div
            key={comment.ID}
            className={`border rounded px-3 py-2 mb-1 text-xs cursor-pointer ${style.className}`}
            onClick={() => onClick?.(comment)}
          >
            <span className="font-bold mr-2">{style.label}</span>
            <span className="text-foreground">{comment.Body}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Hunk header decoration ---

function HunkHeader({ hunk }: { hunk: HunkData }) {
  return (
    <Decoration>
      <div className="bg-secondary/50 text-diff-hunk text-xs px-4 py-0.5 select-none">
        {hunk.content}
      </div>
    </Decoration>
  );
}

// --- Main component ---

export function DiffView({
  diff,
  comments,
  viewType,
  focused,
  onLineClick,
  onCommentClick,
}: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse diff using react-diff-view's parser
  const [file] = useMemo(() => {
    if (!diff || diff.Hunks.length === 0) return [null];
    const unified = toUnifiedDiff(diff);
    const files = parseDiff(unified, { nearbySequences: "zip" });
    return [files[0] ?? null];
  }, [diff]);

  // Compute word-level edits
  const tokens = useMemo((): HunkTokens | null => {
    if (!file) return null;
    try {
      return tokenize(file.hunks, {
        highlight: false,
        enhancers: [markEdits(file.hunks, { type: "block" })],
      } as Parameters<typeof tokenize>[1]);
    } catch {
      return null;
    }
  }, [file]);

  // Build widgets map: changeKey → ReactNode
  const widgets = useMemo(() => {
    if (!file || comments.length === 0) return {};

    const widgetMap: Record<string, React.ReactNode> = {};

    // Group comments by their target line
    const commentsByLine = new Map<number, ReviewComment[]>();
    for (const comment of comments) {
      const line = comment.LineEnd || comment.LineStart;
      if (line <= 0) continue;
      const existing = commentsByLine.get(line) ?? [];
      existing.push(comment);
      commentsByLine.set(line, existing);
    }

    // Map line numbers to change keys
    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        let lineNum: number | undefined;
        if (change.type === "insert") {
          lineNum = change.lineNumber;
        } else if (change.type === "delete") {
          lineNum = change.lineNumber;
        } else {
          lineNum = change.newLineNumber;
        }

        if (lineNum && commentsByLine.has(lineNum)) {
          const key = getChangeKey(change);
          widgetMap[key] = (
            <CommentWidget
              comments={commentsByLine.get(lineNum)!}
              onClick={onCommentClick}
            />
          );
        }
      }
    }

    return widgetMap;
  }, [file, comments, onCommentClick]);

  // Gutter click handler — react-diff-view passes (change) not a DOM event
  const gutterEvents = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick: (...args: any[]) => {
        if (!onLineClick) return;
        const change = args[0]?.change;
        if (!change) return;
        if (change.type === "insert") {
          onLineClick(change.lineNumber, "new");
        } else if (change.type === "delete") {
          onLineClick(change.lineNumber, "old");
        } else if (change.type === "normal") {
          onLineClick(change.newLineNumber, "new");
        }
      },
    }),
    [onLineClick],
  );

  // Scroll to top when diff changes
  useEffect(() => {
    containerRef.current?.scrollTo(0, 0);
  }, [diff.Path]);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>No diff to display</p>
      </div>
    );
  }

  const diffType: DiffType = diff.Hunks.every((h) =>
    h.Lines.every((l) => l.Kind === "added"),
  )
    ? "add"
    : diff.Hunks.every((h) =>
          h.Lines.every((l) => l.Kind === "removed"),
        )
      ? "delete"
      : "modify";

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto selectable ${focused ? "" : "opacity-90"}`}
    >
      {/* File header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
        <span className="text-foreground font-medium">{diff.Path}</span>
        <span>
          {diff.Hunks.length} hunk{diff.Hunks.length !== 1 ? "s" : ""}
        </span>
        {comments.length > 0 && (
          <span className="text-ctp-yellow">
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <Diff
        viewType={viewType}
        diffType={diffType}
        hunks={file.hunks}
        widgets={widgets}
        tokens={tokens ?? undefined}
        gutterEvents={gutterEvents as any}
      >
        {(hunks) =>
          hunks.flatMap((hunk) => [
            <HunkHeader key={`deco-${hunk.content}`} hunk={hunk} />,
            <Hunk key={hunk.content} hunk={hunk} />,
          ])
        }
      </Diff>
    </div>
  );
}
