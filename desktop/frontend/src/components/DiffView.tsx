import {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
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
  ChangeData,
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

export interface DiffViewHandle {
  moveCursor: (delta: number) => void;
  scroll: (delta: number) => void;
  getCursorLine: () => number;
  toggleVisualMode: () => void;
  isVisualMode: () => boolean;
  getSelectionRange: () => { start: number; end: number } | null;
  exitVisualMode: () => void;
}

interface DiffViewProps {
  diff: DiffResult;
  comments: ReviewComment[];
  viewType: ViewType;
  focused: boolean;
  onFocus?: () => void;
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
  }, [diff.Path, diff.Hunks]);

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
            <span className="text-foreground font-sans">{comment.Body}</span>
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

// --- Helpers ---

function changeLineNumber(change: ChangeData): number {
  return change.type === "normal" ? change.newLineNumber : change.lineNumber;
}

// --- Main component ---

export const DiffView = forwardRef<DiffViewHandle, DiffViewProps>(
  function DiffView(
    { diff, comments, viewType, focused, onFocus, onLineClick, onCommentClick },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lineHtml = useShikiHighlight(diff);
    const [cursorIndex, setCursorIndex] = useState(0);
    const [visualMode, setVisualMode] = useState(false);
    const [visualAnchor, setVisualAnchor] = useState(0);

    // Parse diff
    const [file] = useMemo(() => {
      if (!diff || diff.Hunks.length === 0) return [null];
      const unified = toUnifiedDiff(diff);
      const files = parseDiff(unified, { nearbySequences: "zip" });
      return [files[0] ?? null];
    }, [diff]);

    // Flatten all changes for cursor navigation
    const allChanges = useMemo(() => {
      if (!file) return [];
      const changes: ChangeData[] = [];
      for (const hunk of file.hunks) {
        for (const change of hunk.changes) {
          changes.push(change);
        }
      }
      return changes;
    }, [file]);

    // Reset cursor and visual mode when diff changes
    useEffect(() => {
      setCursorIndex(0);
      setVisualMode(false);
      containerRef.current?.scrollTo(0, 0);
    }, [diff.Path]);

    // Scroll selected line into view after render
    useEffect(() => {
      if (!focused || allChanges.length === 0) return;
      const container = containerRef.current;
      if (!container) return;
      // react-diff-view applies .diff-code-selected to the selected change row
      const selectedRow = container.querySelector(
        ".diff-code-selected",
      ) as HTMLElement | null;
      if (selectedRow) {
        selectedRow.scrollIntoView({ block: "nearest" });
      }
    }, [cursorIndex, focused, allChanges.length]);

    // Map change key → index for fast DOM-to-index lookups
    const changeKeyToIndex = useMemo(() => {
      const map = new Map<string, number>();
      for (let i = 0; i < allChanges.length; i++) {
        map.set(getChangeKey(allChanges[i]), i);
      }
      return map;
    }, [allChanges]);

    const moveCursor = useCallback(
      (delta: number) => {
        const normalMove = () =>
          setCursorIndex((prev) =>
            Math.max(0, Math.min(prev + delta, allChanges.length - 1)),
          );

        const container = containerRef.current;
        if (!container) {
          normalMove();
          return;
        }

        const cRect = container.getBoundingClientRect();

        // Check if current cursor is visible
        const selected = container.querySelector(
          ".diff-code-selected",
        ) as HTMLElement | null;
        if (selected) {
          const sRect = selected.getBoundingClientRect();
          if (sRect.bottom > cRect.top && sRect.top < cRect.bottom) {
            normalMove();
            return;
          }
        }

        // Cursor is off-screen — snap to the first/last visible change
        // react-diff-view puts data-change-key on code <td> elements
        const cells = container.querySelectorAll("td[data-change-key]");
        if (delta > 0) {
          for (const cell of cells) {
            const r = cell.getBoundingClientRect();
            if (r.bottom > cRect.top && r.top < cRect.bottom) {
              const key = cell.getAttribute("data-change-key");
              const idx = key ? changeKeyToIndex.get(key) : undefined;
              if (idx !== undefined) {
                setCursorIndex(idx);
                return;
              }
            }
          }
        } else {
          for (let i = cells.length - 1; i >= 0; i--) {
            const r = cells[i].getBoundingClientRect();
            if (r.top < cRect.bottom && r.bottom > cRect.top) {
              const key = cells[i].getAttribute("data-change-key");
              const idx = key ? changeKeyToIndex.get(key) : undefined;
              if (idx !== undefined) {
                setCursorIndex(idx);
                return;
              }
            }
          }
        }

        normalMove();
      },
      [allChanges.length, changeKeyToIndex],
    );

    const scroll = useCallback((delta: number) => {
      containerRef.current?.scrollBy({ top: delta * 80 });
    }, []);

    const getCursorLine = useCallback(() => {
      const change = allChanges[cursorIndex];
      return change ? changeLineNumber(change) : 0;
    }, [allChanges, cursorIndex]);

    const toggleVisualMode = useCallback(() => {
      if (visualMode) {
        setVisualMode(false);
      } else {
        setVisualAnchor(cursorIndex);
        setVisualMode(true);
      }
    }, [visualMode, cursorIndex]);

    const exitVisualMode = useCallback(() => {
      setVisualMode(false);
    }, []);

    const isVisualMode = useCallback(() => visualMode, [visualMode]);

    const getSelectionRange = useCallback(() => {
      if (!visualMode) return null;
      const lo = Math.min(visualAnchor, cursorIndex);
      const hi = Math.max(visualAnchor, cursorIndex);
      const startChange = allChanges[lo];
      const endChange = allChanges[hi];
      if (!startChange || !endChange) return null;
      return {
        start: changeLineNumber(startChange),
        end: changeLineNumber(endChange),
      };
    }, [visualMode, visualAnchor, cursorIndex, allChanges]);

    // Mouse-driven selection: click moves cursor, drag enters visual mode
    const isDragging = useRef(false);
    const dragAnchor = useRef(0);

    const indexFromMouseEvent = useCallback(
      (e: React.MouseEvent | MouseEvent): number | undefined => {
        const target = e.target as HTMLElement;
        const cell = target.closest("td[data-change-key]") as HTMLElement | null;
        if (!cell) return undefined;
        const key = cell.getAttribute("data-change-key");
        return key ? changeKeyToIndex.get(key) : undefined;
      },
      [changeKeyToIndex],
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        // Always claim focus when clicking in the diff view
        onFocus?.();
        const idx = indexFromMouseEvent(e);
        if (idx === undefined) return;
        // Prevent native text selection during drag
        e.preventDefault();
        isDragging.current = true;
        dragAnchor.current = idx;
        setCursorIndex(idx);
        setVisualAnchor(idx);
        setVisualMode(false); // will activate on drag if mouse moves to a different line
      },
      [indexFromMouseEvent, onFocus],
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const idx = indexFromMouseEvent(e);
        if (idx === undefined) return;
        setCursorIndex(idx);
        if (idx !== dragAnchor.current) {
          setVisualMode(true);
        }
      },
      [indexFromMouseEvent],
    );

    const handleMouseUp = useCallback(() => {
      isDragging.current = false;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        moveCursor,
        scroll,
        getCursorLine,
        toggleVisualMode,
        isVisualMode,
        getSelectionRange,
        exitVisualMode,
      }),
      [moveCursor, scroll, getCursorLine, toggleVisualMode, isVisualMode, getSelectionRange, exitVisualMode],
    );

    // Selected change keys for highlight (single line or visual range)
    const selectedChanges = useMemo(() => {
      if (allChanges.length === 0) return [];
      if (visualMode) {
        const lo = Math.min(visualAnchor, cursorIndex);
        const hi = Math.max(visualAnchor, cursorIndex);
        const keys: string[] = [];
        for (let i = lo; i <= hi && i < allChanges.length; i++) {
          keys.push(getChangeKey(allChanges[i]));
        }
        return keys;
      }
      const change = allChanges[cursorIndex];
      if (!change) return [];
      return [getChangeKey(change)];
    }, [allChanges, cursorIndex, visualMode, visualAnchor]);

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
          const lineNum = changeLineNumber(change);
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
          const side = change.type === "delete" ? "old" : "new";
          onLineClick(changeLineNumber(change), side);
        },
      }),
      [onLineClick],
    );

    // Custom token renderer that injects Shiki-highlighted HTML
    const renderToken = useMemo(() => {
      if (lineHtml.size === 0) return undefined;

      return (
        token: {
          value: string;
          className: string;
          children?: React.ReactNode;
        },
        defaultRender: (token: {
          value: string;
          className: string;
        }) => React.ReactNode,
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
        className={`h-full overflow-auto selectable font-mono ${focused ? "" : "opacity-90"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
          {visualMode && (
            <span className="text-ctp-mauve font-medium">VISUAL</span>
          )}
        </div>

        <Diff
          viewType={viewType}
          diffType={diffType}
          hunks={file.hunks}
          widgets={widgets}
          selectedChanges={selectedChanges}
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
  },
);
