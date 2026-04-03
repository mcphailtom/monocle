import { useMemo, useRef, useEffect, useState } from "react";
import {
  Diff,
  Hunk,
  parseDiff,
  Decoration,
  getChangeKey,
  tokenize,
} from "react-diff-view";
import type {
  HunkData,
  ViewType,
  DiffType,
  HunkTokens,
} from "react-diff-view";
import { createHighlighter, type Highlighter } from "shiki";
import type { DiffResult, ReviewComment, CommentType } from "../types";

// --- Language detection ---

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  go: "go", rs: "rust", py: "python", rb: "ruby",
  java: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp",
  cs: "csharp", css: "css", scss: "scss", less: "less",
  html: "html", htm: "html", xml: "xml", svg: "xml",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", mdx: "markdown",
  sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
  sql: "sql", graphql: "graphql",
  dockerfile: "dockerfile", makefile: "makefile",
  lua: "lua", zig: "zig", lock: "json",
};

function detectLanguage(path: string): string {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (name === "makefile" || name === "dockerfile") return name;
  const ext = name.split(".").pop() ?? "";
  return EXT_TO_LANG[ext] ?? "text";
}

// --- Shiki singleton ---

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["catppuccin-mocha"],
      langs: [
        "typescript", "tsx", "javascript", "jsx", "go", "rust", "python",
        "ruby", "java", "kotlin", "swift", "c", "cpp", "csharp",
        "css", "scss", "less", "html", "xml", "json", "yaml", "toml",
        "markdown", "bash", "sql", "graphql", "dockerfile", "makefile",
        "lua", "zig",
      ],
    });
  }
  return highlighterPromise;
}

// --- Props ---

interface DiffViewProps {
  diff: DiffResult;
  comments: ReviewComment[];
  viewType: ViewType;
  focused: boolean;
  onLineClick?: (lineNumber: number, side: "old" | "new") => void;
  onCommentClick?: (comment: ReviewComment) => void;
}

// --- Convert DiffResult to unified diff string ---

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

// --- Build highlighted line map using Shiki ---

function useShikiHighlight(diff: DiffResult) {
  const [lineHtml, setLineHtml] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const lang = detectLanguage(diff.Path);
    if (lang === "text") return;

    // Collect all unique source lines from hunks
    const allLines: string[] = [];
    for (const hunk of diff.Hunks) {
      for (const line of hunk.Lines) {
        allLines.push(line.Content);
      }
    }
    if (allLines.length === 0) return;

    // Join into one block so Shiki gets syntax context across lines
    const code = allLines.join("\n");

    getHighlighter().then((highlighter) => {
      if (cancelled) return;

      let tokens;
      try {
        tokens = highlighter.codeToTokens(code, {
          lang,
          theme: "catppuccin-mocha",
        });
      } catch {
        return; // language not supported
      }

      const map = new Map<string, string>();
      for (let i = 0; i < tokens.tokens.length && i < allLines.length; i++) {
        const lineTokens = tokens.tokens[i];
        const html = lineTokens
          .map((t) => {
            const escaped = t.content
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            if (t.color) {
              return `<span style="color:${t.color}">${escaped}</span>`;
            }
            return escaped;
          })
          .join("");
        map.set(allLines[i], html);
      }

      if (!cancelled) setLineHtml(map);
    });

    return () => { cancelled = true; };
  }, [diff]);

  return lineHtml;
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
  const lineHtml = useShikiHighlight(diff);

  // Parse diff
  const [file] = useMemo(() => {
    if (!diff || diff.Hunks.length === 0) return [null];
    const unified = toUnifiedDiff(diff);
    const files = parseDiff(unified, { nearbySequences: "zip" });
    return [files[0] ?? null];
  }, [diff]);

  // Structural tokens (no syntax highlight — just gives renderToken something to work with)
  const tokens = useMemo((): HunkTokens | null => {
    if (!file) return null;
    try {
      return tokenize(file.hunks, {
        highlight: false,
      } as Parameters<typeof tokenize>[1]);
    } catch {
      return null;
    }
  }, [file]);

  // Build widgets map
  const widgets = useMemo(() => {
    if (!file || comments.length === 0) return {};

    const widgetMap: Record<string, React.ReactNode> = {};
    const commentsByLine = new Map<number, ReviewComment[]>();
    for (const comment of comments) {
      const line = comment.LineEnd || comment.LineStart;
      if (line <= 0) continue;
      const existing = commentsByLine.get(line) ?? [];
      existing.push(comment);
      commentsByLine.set(line, existing);
    }

    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        let lineNum: number | undefined;
        if (change.type === "insert") lineNum = change.lineNumber;
        else if (change.type === "delete") lineNum = change.lineNumber;
        else lineNum = change.newLineNumber;

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

  // Gutter click handler
  const gutterEvents = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick: (...args: any[]) => {
        if (!onLineClick) return;
        const change = args[0]?.change;
        if (!change) return;
        if (change.type === "insert") onLineClick(change.lineNumber, "new");
        else if (change.type === "delete") onLineClick(change.lineNumber, "old");
        else if (change.type === "normal") onLineClick(change.newLineNumber, "new");
      },
    }),
    [onLineClick],
  );

  // Custom token renderer that injects Shiki-highlighted HTML
  const renderToken = useMemo(() => {
    if (lineHtml.size === 0) return undefined;

    return (
      token: { value: string; className: string; children?: React.ReactNode },
      defaultRender: (token: { value: string; className: string }) => React.ReactNode,
      i: number,
    ) => {
      // Only apply to the code content tokens (not gutter, not edit markers)
      const highlighted = lineHtml.get(token.value);
      if (highlighted && !token.className?.includes("diff-code-edit")) {
        return (
          <span
            key={i}
            className={token.className}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        );
      }
      return defaultRender(token);
    };
  }, [lineHtml]);

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
    : diff.Hunks.every((h) => h.Lines.every((l) => l.Kind === "removed"))
      ? "delete"
      : "modify";

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto selectable ${focused ? "" : "opacity-90"}`}
    >
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
        renderToken={renderToken as any}
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
