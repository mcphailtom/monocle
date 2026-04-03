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
  scrollHalfPage: (direction: 1 | -1) => void;
  scrollHorizontal: (delta: number) => void;
  scrollToColumn: (target: "start" | "end") => void;
  getCursorLine: () => number;
  getCommentAtCursor: () => ReviewComment | null;
  toggleVisualMode: () => void;
  isVisualMode: () => boolean;
  getSelectionRange: () => { start: number; end: number } | null;
  getSelectedContent: () => string;
  jumpToComment: (direction: 1 | -1) => void;
  exitVisualMode: () => void;
}

interface DiffViewProps {
  diff: DiffResult;
  comments: ReviewComment[];
  viewType: ViewType;
  focused: boolean;
  wrap?: boolean;
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

const COMMENT_TYPE_STYLES: Record<CommentType, { label: string; base: string; focused: string }> = {
  issue: { label: "Issue", base: "bg-comment-issue/20 border-comment-issue/40 text-comment-issue", focused: "bg-comment-issue/50 border-comment-issue text-comment-issue" },
  suggestion: { label: "Suggestion", base: "bg-comment-suggest/20 border-comment-suggest/40 text-comment-suggest", focused: "bg-comment-suggest/50 border-comment-suggest text-comment-suggest" },
  note: { label: "Note", base: "bg-comment-note/20 border-comment-note/40 text-comment-note", focused: "bg-comment-note/50 border-comment-note text-comment-note" },
  praise: { label: "Praise", base: "bg-comment-praise/20 border-comment-praise/40 text-comment-praise", focused: "bg-comment-praise/50 border-comment-praise text-comment-praise" },
};

function CommentWidget({
  comments,
  focusedId,
  onClick,
}: {
  comments: ReviewComment[];
  focusedId?: string | null;
  onClick?: (c: ReviewComment) => void;
}) {
  return (
    <div className="mx-2 my-1">
      {comments.map((comment) => {
        const style = COMMENT_TYPE_STYLES[comment.Type] ?? COMMENT_TYPE_STYLES.note;
        const isFocused = focusedId === comment.ID;
        return (
          <div
            key={comment.ID}
            data-comment-id={comment.ID}
            className={`border rounded px-3 py-2 mb-1 text-xs cursor-pointer ${isFocused ? style.focused : style.base}`}
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
    { diff, comments, viewType, focused, wrap, onFocus, onLineClick, onCommentClick },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lineHtml = useShikiHighlight(diff);
    const [cursorIndex, setCursorIndex] = useState(0);
    const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
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

    // Map change index → comments on that line (for nav interleaving)
    // Index -1 is used for file-level comments (LineStart === 0)
    const commentsByChangeIdx = useMemo(() => {
      const map = new Map<number, ReviewComment[]>();
      if (allChanges.length === 0 || comments.length === 0) return map;
      // File-level comments at sentinel index -1
      const fileLevelComments = comments.filter((c) => c.LineStart === 0);
      if (fileLevelComments.length > 0) map.set(-1, fileLevelComments);
      const lineToComments = new Map<number, ReviewComment[]>();
      for (const c of comments) {
        const line = c.LineEnd || c.LineStart;
        if (line <= 0) continue;
        const arr = lineToComments.get(line) ?? [];
        arr.push(c);
        lineToComments.set(line, arr);
      }
      for (let i = 0; i < allChanges.length; i++) {
        const change = allChanges[i];
        if (change.type === "delete") continue;
        const lineNum = changeLineNumber(change);
        const coms = lineToComments.get(lineNum);
        if (coms && coms.length > 0) map.set(i, coms);
      }
      return map;
    }, [allChanges, comments]);

    // Reset cursor and visual mode when diff changes
    useEffect(() => {
      setCursorIndex(0);
      setFocusedCommentId(null);
      setVisualMode(false);
      containerRef.current?.scrollTo(0, 0);
    }, [diff.Path]);

    // Scroll selected line or focused comment into view after render
    useEffect(() => {
      if (!focused || allChanges.length === 0) return;
      const container = containerRef.current;
      if (!container) return;
      if (focusedCommentId) {
        const el = container.querySelector(`[data-comment-id="${focusedCommentId}"]`) as HTMLElement | null;
        if (el) { el.scrollIntoView({ block: "nearest" }); return; }
      }
      const selectedRow = container.querySelector(
        ".diff-code-selected",
      ) as HTMLElement | null;
      if (selectedRow) {
        selectedRow.scrollIntoView({ block: "nearest" });
      }
    }, [cursorIndex, focusedCommentId, focused, allChanges.length]);

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
        // When on a focused comment, navigate within or out of comments
        if (focusedCommentId) {
          // Check if this is a file-level comment (sentinel -1) or a line comment
          const fileLevelComs = commentsByChangeIdx.get(-1);
          const isFileLevel = fileLevelComs?.some((c) => c.ID === focusedCommentId);
          const coms = isFileLevel ? fileLevelComs! : commentsByChangeIdx.get(cursorIndex);
          if (coms) {
            const comIdx = coms.findIndex((c) => c.ID === focusedCommentId);
            if (delta > 0) {
              if (comIdx < coms.length - 1) {
                setFocusedCommentId(coms[comIdx + 1].ID);
                return;
              }
              // No more comments — move to next change
              setFocusedCommentId(null);
              if (isFileLevel) {
                setCursorIndex(0); // go to first change
              } else {
                setCursorIndex((prev) => Math.min(prev + 1, allChanges.length - 1));
              }
              return;
            } else {
              if (comIdx > 0) {
                setFocusedCommentId(coms[comIdx - 1].ID);
                return;
              }
              // Back to the code line (or nowhere if file-level)
              setFocusedCommentId(null);
              if (isFileLevel) return; // already at top
              return;
            }
          }
          setFocusedCommentId(null);
        }

        const normalMove = () => {
          setCursorIndex((prev) => {
            const next = Math.max(0, Math.min(prev + delta, allChanges.length - 1));
            // When moving down past a line with comments, stop on first comment
            if (delta > 0 && commentsByChangeIdx.has(prev) && next !== prev) {
              const coms = commentsByChangeIdx.get(prev)!;
              setFocusedCommentId(coms[0].ID);
              return prev; // stay on same change index
            }
            // When moving up from first change, stop on file-level comments
            if (delta < 0 && prev === 0 && next === 0 && commentsByChangeIdx.has(-1)) {
              const coms = commentsByChangeIdx.get(-1)!;
              setFocusedCommentId(coms[coms.length - 1].ID);
              return 0;
            }
            // When moving up into a line with comments, stop on last comment
            if (delta < 0 && commentsByChangeIdx.has(next) && next !== prev) {
              const coms = commentsByChangeIdx.get(next)!;
              setFocusedCommentId(coms[coms.length - 1].ID);
              return next;
            }
            return next;
          });
        };

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
        const cells = container.querySelectorAll("td[data-change-key]");
        if (delta > 0) {
          for (const cell of cells) {
            const r = cell.getBoundingClientRect();
            if (r.bottom > cRect.top && r.top < cRect.bottom) {
              const key = cell.getAttribute("data-change-key");
              const idx = key ? changeKeyToIndex.get(key) : undefined;
              if (idx !== undefined) {
                setFocusedCommentId(null);
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
                setFocusedCommentId(null);
                setCursorIndex(idx);
                return;
              }
            }
          }
        }

        normalMove();
      },
      [allChanges.length, changeKeyToIndex, focusedCommentId, cursorIndex, commentsByChangeIdx],
    );

    const scroll = useCallback((delta: number) => {
      containerRef.current?.scrollBy({ top: delta * 80 });
    }, []);

    const scrollHalfPage = useCallback((direction: 1 | -1) => {
      const container = containerRef.current;
      if (!container) return;
      container.scrollBy({ top: direction * (container.clientHeight / 2) });
    }, []);

    const scrollHorizontal = useCallback((delta: number) => {
      containerRef.current?.scrollBy({ left: delta * 40 });
    }, []);

    const scrollToColumn = useCallback((target: "start" | "end") => {
      const container = containerRef.current;
      if (!container) return;
      if (target === "start") {
        container.scrollLeft = 0;
      } else {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
      }
    }, []);

    const getCursorLine = useCallback(() => {
      const change = allChanges[cursorIndex];
      return change ? changeLineNumber(change) : 0;
    }, [allChanges, cursorIndex]);

    const getCommentAtCursor = useCallback(() => {
      // If a specific comment is focused via j/k navigation, return it
      if (focusedCommentId) {
        return comments.find((c) => c.ID === focusedCommentId) ?? null;
      }
      const change = allChanges[cursorIndex];
      if (!change) return null;
      const lineNum = changeLineNumber(change);
      for (const comment of comments) {
        const lo = comment.LineStart;
        const hi = comment.LineEnd || comment.LineStart;
        if (lineNum >= lo && lineNum <= hi) return comment;
      }
      return null;
    }, [allChanges, cursorIndex, comments, focusedCommentId]);

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

    const getSelectedContent = useCallback(() => {
      if (visualMode) {
        const lo = Math.min(visualAnchor, cursorIndex);
        const hi = Math.max(visualAnchor, cursorIndex);
        const lines: string[] = [];
        for (let i = lo; i <= hi && i < allChanges.length; i++) {
          const change = allChanges[i];
          // Only include "new" side content (normal + insert, skip deletes)
          if (change.type !== "delete") {
            lines.push(change.content);
          }
        }
        return lines.join("\n");
      }
      const change = allChanges[cursorIndex];
      if (!change) return "";
      return change.content;
    }, [visualMode, visualAnchor, cursorIndex, allChanges]);

    // Jump to next/previous comment in the diff
    const jumpToComment = useCallback(
      (direction: 1 | -1) => {
        // Build sorted list of change indices that have comments
        const indices = Array.from(commentsByChangeIdx.keys()).sort((a, b) => a - b);
        if (indices.length === 0) return;

        // Determine current effective position
        // If focused on a comment, use its change index; otherwise use cursorIndex
        const currentIdx = focusedCommentId
          ? (commentsByChangeIdx.get(-1)?.some((c) => c.ID === focusedCommentId) ? -1 : cursorIndex)
          : cursorIndex;

        if (direction > 0) {
          const next = indices.find((i) => i > currentIdx) ?? indices[0];
          const coms = commentsByChangeIdx.get(next)!;
          setFocusedCommentId(coms[0].ID);
          if (next >= 0) setCursorIndex(next);
        } else {
          const prev = [...indices].reverse().find((i) => i < currentIdx) ?? indices[indices.length - 1];
          const coms = commentsByChangeIdx.get(prev)!;
          setFocusedCommentId(coms[0].ID);
          if (prev >= 0) setCursorIndex(prev);
        }
      },
      [commentsByChangeIdx, cursorIndex, focusedCommentId],
    );

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
        setFocusedCommentId(null);
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
        scrollHalfPage,
        scrollHorizontal,
        scrollToColumn,
        getCursorLine,
        getCommentAtCursor,
        toggleVisualMode,
        isVisualMode,
        getSelectionRange,
        getSelectedContent,
        jumpToComment,
        exitVisualMode,
      }),
      [moveCursor, scroll, scrollHalfPage, scrollHorizontal, scrollToColumn, getCursorLine, getCommentAtCursor, toggleVisualMode, isVisualMode, getSelectionRange, getSelectedContent, jumpToComment, exitVisualMode],
    );

    // Selected change keys for highlight (single line or visual range)
    const selectedChanges = useMemo(() => {
      if (allChanges.length === 0) return [];
      // Don't highlight a code line when a comment is focused
      if (focusedCommentId) return [];
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
    }, [allChanges, cursorIndex, visualMode, visualAnchor, focusedCommentId]);

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
          // Only attach widgets to new-side lines to avoid duplicates in split view
          if (change.type === "delete") continue;
          const lineNum = changeLineNumber(change);
          if (lineNum && commentsByLine.has(lineNum)) {
            const key = getChangeKey(change);
            widgetMap[key] = (
              <CommentWidget
                comments={commentsByLine.get(lineNum)!}
                focusedId={focusedCommentId}
                onClick={onCommentClick}
              />
            );
          }
        }
      }
      return widgetMap;
    }, [file, comments, focusedCommentId, onCommentClick]);

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
        className={`h-full overflow-auto selectable font-mono ${focused ? "" : "opacity-90"} ${wrap ? "diff-wrap" : ""}`}
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

        {/* File-level comments (LineStart === 0) */}
        {comments.some((c) => c.LineStart === 0) && (
          <CommentWidget
            comments={comments.filter((c) => c.LineStart === 0)}
            focusedId={focusedCommentId}
            onClick={onCommentClick}
          />
        )}

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
