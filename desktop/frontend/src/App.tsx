import { useEffect, useState, useCallback, useRef } from "react";
import { api, onEvent } from "./api";
import { Sidebar, type SidebarItem, type SidebarHandle } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { DiffView, type DiffViewHandle } from "./components/DiffView";
import { ContentView } from "./components/ContentView";
import { CommentEditor } from "./components/CommentEditor";
import { ReviewSubmitDialog } from "./components/ReviewSubmitDialog";
import { HelpDialog } from "./components/HelpDialog";
import { CommandPalette } from "./components/CommandPalette";
import { ConnectionInfoDialog } from "./components/ConnectionInfoDialog";
import { HistoryDialog } from "./components/HistoryDialog";
import { BaseRefPicker } from "./components/BaseRefPicker";
import { ProjectPicker } from "./components/ProjectPicker";
import { useKeyboard } from "./hooks/useKeyboard";
import type {
  ReviewSession,
  ChangedFile,
  ContentItem,
  AdditionalFile,
  DiffResult,
  ReviewSummary,
  ReviewComment,
  CommentType,
  TargetType,
} from "./types";
import type { ViewType } from "react-diff-view";

type FocusTarget = "sidebar" | "main";

function App() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const handleSelectProject = useCallback(async (path: string) => {
    setProjectError(null);
    try {
      await api.selectProject(path);
      setProjectPath(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to select project:", msg);
      setProjectError(msg);
    }
  }, []);

  // Listen for File > Open Project menu action (Go dispatches DOM event via WindowExecJS)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { path?: string; error?: string };
      if (detail.error) {
        setProjectError(detail.error);
        setProjectPath(null);
      } else if (detail.path) {
        setProjectError(null);
        setProjectPath(detail.path);
      }
    };
    window.addEventListener("monocle:project-changed", handler);
    return () => window.removeEventListener("monocle:project-changed", handler);
  }, []);

  if (!projectPath) {
    return <ProjectPicker onSelect={handleSelectProject} error={projectError} />;
  }

  return <ReviewUI key={projectPath} />;
}

function ReviewUI() {
  // --- State ---
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [additionalFiles, setAdditionalFiles] = useState<AdditionalFile[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedContentId, setSelectedContentId] = useState("");
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusTarget>("sidebar");
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sidebarCursor, setSidebarCursor] = useState(0);
  const [reviewFilter, setReviewFilter] = useState("");
  const [treeMode, setTreeMode] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [viewType, setViewType] = useState<ViewType>("unified");
  const [contentTitle, setContentTitle] = useState("");
  const [wrap, setWrap] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const preFocusWrap = useRef(false);
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const [expandAllSignal, setExpandAllSignal] = useState(0);

  // Comment editor state
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{
    targetType: TargetType;
    targetRef: string;
    lineStart: number;
    lineEnd: number;
  } | null>(null);
  const [editingComment, setEditingComment] = useState<ReviewComment | null>(null);
  const [suggestionBody, setSuggestionBody] = useState("");

  // Review submit state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);

  // Help, command palette, and modal dialogs
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [connectionInfoOpen, setConnectionInfoOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [baseRefPickerOpen, setBaseRefPickerOpen] = useState(false);

  // Component refs for keyboard navigation
  const diffViewRef = useRef<DiffViewHandle>(null);
  const sidebarRef = useRef<SidebarHandle>(null);

  // --- Data loading ---

  const loadSession = useCallback(async () => {
    try {
      const s = await api.getSession();
      setSession(s);
    } catch {
      // Bindings not ready
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const [f, c, a] = await Promise.all([
        api.getChangedFiles(),
        api.getContentItems(),
        api.getAdditionalFiles(),
      ]);
      setFiles(f ?? []);
      setContentItems(c ?? []);
      setAdditionalFiles(a ?? []);
    } catch {
      // Bindings not ready
    }
  }, []);

  const loadDiff = useCallback(async (path: string) => {
    try {
      const d = await api.getFileDiff(path);
      setDiff(d);
      setFileContent(null);
    } catch {
      setDiff(null);
    }
  }, []);

  const loadContentItem = useCallback(async (id: string) => {
    try {
      const item = await api.getContentItem(id);
      setContentTitle(item?.Title ?? "");
      if (item?.PreviousContent) {
        const d = await api.getContentDiff(id);
        setDiff(d);
        setFileContent(null);
      } else {
        setDiff(null);
        setFileContent(item?.Content ?? null);
      }
    } catch {
      setDiff(null);
      setFileContent(null);
      setContentTitle("");
    }
  }, []);

  const loadAdditionalFile = useCallback(async (path: string) => {
    try {
      const content = await api.getAdditionalFileContent(path);
      setDiff(null);
      setFileContent(content);
    } catch {
      setDiff(null);
      setFileContent(null);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const [count, status] = await Promise.all([
        api.getSubscriberCount(),
        api.getFeedbackStatus(),
      ]);
      setSubscriberCount(count);
      setFeedbackStatus(status);
    } catch {
      // ignore
    }
  }, []);

  // --- Comment actions ---

  const openCommentEditor = useCallback(
    (lineStart: number, lineEnd: number = 0, suggestion: string = "") => {
      const targetType: TargetType = selectedContentId ? "content" : "file";
      const targetRef = selectedContentId || selectedPath;
      if (!targetRef) return;

      setCommentTarget({ targetType, targetRef, lineStart, lineEnd: lineEnd || lineStart });
      setEditingComment(null);
      setSuggestionBody(suggestion);
      setCommentEditorOpen(true);
    },
    [selectedPath, selectedContentId],
  );

  const handleSaveComment = useCallback(
    async (type: CommentType, body: string) => {
      if (!commentTarget) return;
      try {
        if (editingComment) {
          await api.editComment(editingComment.ID, type, body);
        } else {
          await api.addComment(
            commentTarget.targetType,
            commentTarget.targetRef,
            commentTarget.lineStart,
            commentTarget.lineEnd,
            type,
            body,
          );
        }
        // Refresh session to get updated comments
        loadSession();
      } catch (err) {
        console.error("Failed to save comment:", err);
      }
    },
    [commentTarget, editingComment, loadSession],
  );

  const handleEditComment = useCallback((comment: ReviewComment) => {
    setCommentTarget({
      targetType: comment.TargetType,
      targetRef: comment.TargetRef,
      lineStart: comment.LineStart,
      lineEnd: comment.LineEnd,
    });
    setEditingComment(comment);
    setCommentEditorOpen(true);
  }, []);

  const handleMarkReviewed = useCallback(async () => {
    try {
      if (selectedContentId) {
        const item = contentItems.find((c) => c.ID === selectedContentId);
        if (item?.Reviewed) {
          await api.unmarkContentReviewed(selectedContentId);
        } else {
          await api.markContentReviewed(selectedContentId);
        }
      } else if (selectedPath) {
        const file = files.find((f) => f.Path === selectedPath);
        if (file?.Reviewed) {
          await api.unmarkReviewed(selectedPath);
        } else {
          await api.markReviewed(selectedPath);
        }
      }
      loadSession();
      loadFiles();
    } catch (err) {
      console.error("Failed to toggle reviewed:", err);
    }
  }, [selectedPath, selectedContentId, files, contentItems, loadSession, loadFiles]);

  const openReviewDialog = useCallback(async () => {
    try {
      const summary = await api.getReviewSummary();
      setReviewSummary(summary);
      setReviewDialogOpen(true);
    } catch (err) {
      console.error("Failed to get review summary:", err);
    }
  }, []);

  const handleSubmitReview = useCallback(
    async (action: string, body: string) => {
      try {
        await api.submit(action, body);
        loadSession();
        refreshStatus();
      } catch (err) {
        console.error("Failed to submit review:", err);
      }
    },
    [loadSession, refreshStatus],
  );

  const handleRequestPause = useCallback(async () => {
    try {
      await api.requestPause();
      refreshStatus();
    } catch (err) {
      console.error("Failed to request pause:", err);
    }
  }, [refreshStatus]);

  const openSuggestionEditor = useCallback(
    (lineStart: number, lineEnd: number = 0, content: string = "") => {
      openCommentEditor(lineStart, lineEnd, "```suggestion\n" + content + "\n```");
    },
    [openCommentEditor],
  );

  const handleDeleteComment = useCallback(
    async (comment: ReviewComment) => {
      try {
        await api.deleteComment(comment.ID);
        loadSession();
      } catch (err) {
        console.error("Failed to delete comment:", err);
      }
    },
    [loadSession],
  );

  const handleResolveComment = useCallback(
    async (comment: ReviewComment) => {
      try {
        await api.resolveComment(comment.ID);
        loadSession();
      } catch (err) {
        console.error("Failed to resolve comment:", err);
      }
    },
    [loadSession],
  );

  const handleForceReload = useCallback(async () => {
    try {
      await api.refreshChangedFiles();
      loadFiles();
      loadSession();
      // Reload current selection
      if (selectedPath) loadDiff(selectedPath);
      else if (selectedContentId) loadContentItem(selectedContentId);
    } catch (err) {
      console.error("Failed to reload:", err);
    }
  }, [loadFiles, loadSession, loadDiff, loadContentItem, selectedPath, selectedContentId]);

  const handleClearReview = useCallback(async () => {
    try {
      await api.clearReview();
      loadSession();
      loadFiles();
    } catch (err) {
      console.error("Failed to clear review:", err);
    }
  }, [loadSession, loadFiles]);

  const handleBaseRefSelect = useCallback(
    async (ref: string) => {
      try {
        await api.setBaseRef(ref);
        // Reload everything with new base
        loadFiles();
        loadSession();
        if (selectedPath) loadDiff(selectedPath);
        else if (selectedContentId) loadContentItem(selectedContentId);
      } catch (err) {
        console.error("Failed to set base ref:", err);
      }
    },
    [loadFiles, loadSession, loadDiff, loadContentItem, selectedPath, selectedContentId],
  );

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      if (next) {
        preFocusWrap.current = wrap;
        setSidebarHidden(true);
        setWrap(true);
      } else {
        setSidebarHidden(false);
        setWrap(preFocusWrap.current);
      }
      return next;
    });
  }, [wrap]);

  const handleCommand = useCallback(
    async (command: string) => {
      switch (command) {
        case "submit":
          openReviewDialog();
          break;
        case "pause":
          handleRequestPause();
          break;
        case "clear":
          await api.clearComments();
          loadSession();
          break;
        case "mark-all-reviewed":
          await api.markAllReviewed();
          loadSession();
          loadFiles();
          break;
        case "discard":
          await api.clearReview();
          loadSession();
          loadFiles();
          break;
        case "mark-all-unreviewed":
          await api.resetAllReviewed();
          loadSession();
          loadFiles();
          break;
        case "history":
          setHistoryOpen(true);
          break;
      }
    },
    [openReviewDialog, handleRequestPause, loadSession, loadFiles],
  );

  // --- Initial load ---

  useEffect(() => {
    loadSession();
    loadFiles();
    refreshStatus();
  }, [loadSession, loadFiles, refreshStatus]);

  // --- Events ---

  useEffect(() => {
    const unsubs = [
      onEvent("file_changed", () => {
        loadFiles();
        loadSession();
      }),
      onEvent("content_item_added", () => {
        loadFiles();
        loadSession();
      }),
      onEvent("additional_file_added", () => {
        loadFiles();
        loadSession();
      }),
      onEvent("connection_changed", () => {
        refreshStatus();
      }),
      onEvent("feedback_status_changed", () => {
        refreshStatus();
      }),
      onEvent("feedback_picked_up", () => {
        refreshStatus();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [loadFiles, loadSession, refreshStatus]);

  // --- Selection ---

  const handleSidebarSelect = useCallback(
    (item: SidebarItem) => {
      switch (item.kind) {
        case "file":
        case "tree-file":
          setSelectedPath(item.file.Path);
          setSelectedContentId("");
          loadDiff(item.file.Path);
          break;
        case "content":
          setSelectedContentId(item.item.ID);
          setSelectedPath("");
          loadContentItem(item.item.ID);
          break;
        case "additional":
          setSelectedPath(item.file.Path);
          setSelectedContentId("");
          loadAdditionalFile(item.file.Path);
          break;
      }
    },
    [loadDiff, loadContentItem, loadAdditionalFile],
  );

  // --- Sidebar cursor movement with auto-select ---

  // Track sidebar items so cursor movement can trigger selection
  const sidebarItemsRef = useRef<SidebarItem[]>([]);
  const handleSidebarItems = useCallback((items: SidebarItem[]) => {
    sidebarItemsRef.current = items;
  }, []);

  const moveSidebarCursor = useCallback(
    (delta: number) => {
      setSidebarCursor((c) => {
        const items = sidebarItemsRef.current;
        let next = c + delta;
        // Skip section headers
        while (next >= 0 && next < items.length && items[next]?.kind === "section") {
          next += delta > 0 ? 1 : -1;
        }
        next = Math.max(0, Math.min(next, items.length - 1));
        // Select the item at new cursor
        const item = items[next];
        if (item && item.kind !== "section" && item.kind !== "dir") {
          handleSidebarSelect(item);
        }
        return next;
      });
    },
    [handleSidebarSelect],
  );

  const moveSidebarCursorTo = useCallback(
    (pos: number) => {
      const items = sidebarItemsRef.current;
      const clamped = Math.max(0, Math.min(pos, items.length - 1));
      setSidebarCursor(clamped);
      const item = items[clamped];
      if (item && item.kind !== "section" && item.kind !== "dir") {
        handleSidebarSelect(item);
      }
    },
    [handleSidebarSelect],
  );

  // --- Keyboard ---

  useKeyboard([
    // Focus
    {
      key: "Tab",
      handler: () => setFocus((f) => (f === "sidebar" ? "main" : "sidebar")),
    },
    {
      key: "\\",
      handler: () => setSidebarHidden((h) => !h),
    },
    {
      key: "1",
      handler: () => { setFocus("sidebar"); setSidebarHidden(false); },
    },
    {
      key: "2",
      handler: () => setFocus("main"),
    },

    // Sidebar navigation (when sidebar focused)
    {
      key: "j",
      handler: () => moveSidebarCursor(1),
      when: () => focus === "sidebar",
    },
    {
      key: "k",
      handler: () => moveSidebarCursor(-1),
      when: () => focus === "sidebar",
    },
    {
      key: "g",
      handler: () => moveSidebarCursorTo(0),
      when: () => focus === "sidebar",
    },
    {
      key: "shift+g",
      handler: () => moveSidebarCursorTo(sidebarItemsRef.current.length - 1),
      when: () => focus === "sidebar",
    },

    // Enter: focus diff pane (on file/content), toggle dir (on tree dir)
    {
      key: "enter",
      handler: () => {
        const item = sidebarItemsRef.current[sidebarCursor];
        if (!item) return;
        if (item.kind === "dir") {
          sidebarRef.current?.toggleDir(item.path);
        } else if (item.kind !== "section") {
          setFocus("main");
        }
      },
      when: () => focus === "sidebar",
    },

    // Sidebar toggles
    {
      key: "f",
      handler: () => setTreeMode((t) => !t),
      when: () => focus === "sidebar",
    },

    // Collapse all tree dirs (z key)
    {
      key: "z",
      handler: () => setCollapseAllSignal((n) => n + 1),
      when: () => focus === "sidebar" && treeMode,
    },
    // Expand all tree dirs (e key)
    {
      key: "e",
      handler: () => setExpandAllSignal((n) => n + 1),
      when: () => focus === "sidebar" && treeMode,
    },
    {
      key: "/",
      handler: () =>
        setReviewFilter((f) =>
          f === "" ? "reviewed" : f === "reviewed" ? "unreviewed" : "",
        ),
      when: () => focus === "sidebar",
    },

    // File navigation (global — skips sections and dirs)
    {
      key: "[",
      handler: () => {
        const items = sidebarItemsRef.current;
        for (let i = sidebarCursor - 1; i >= 0; i--) {
          if (items[i]?.kind !== "section" && items[i]?.kind !== "dir") {
            moveSidebarCursorTo(i);
            return;
          }
        }
      },
    },
    {
      key: "]",
      handler: () => {
        const items = sidebarItemsRef.current;
        for (let i = sidebarCursor + 1; i < items.length; i++) {
          if (items[i]?.kind !== "section" && items[i]?.kind !== "dir") {
            moveSidebarCursorTo(i);
            return;
          }
        }
      },
    },

    // Diff view controls (when main pane focused)
    {
      key: "t",
      handler: () =>
        setViewType((v) => (v === "unified" ? "split" : "unified")),
      when: () => focus === "main",
    },

    // Diff line navigation (when main pane focused)
    {
      key: "j",
      handler: () => diffViewRef.current?.moveCursor(1),
      when: () => focus === "main",
    },
    {
      key: "k",
      handler: () => diffViewRef.current?.moveCursor(-1),
      when: () => focus === "main",
    },
    // Diff scrolling (Shift+J/K — works from any pane)
    {
      key: "shift+j",
      handler: () => diffViewRef.current?.scroll(1),
    },
    {
      key: "shift+k",
      handler: () => diffViewRef.current?.scroll(-1),
    },

    // Visual selection mode
    {
      key: "v",
      handler: () => diffViewRef.current?.toggleVisualMode(),
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },

    // Commenting (when main pane focused, no dialog open)
    {
      key: "c",
      handler: () => {
        const range = diffViewRef.current?.getSelectionRange();
        if (range) {
          openCommentEditor(range.start, range.end);
          diffViewRef.current?.exitVisualMode();
        } else {
          openCommentEditor(diffViewRef.current?.getCursorLine() ?? 1);
        }
      },
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },

    // Review actions (global, no dialog open)
    {
      key: "r",
      handler: handleMarkReviewed,
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "shift+s",
      handler: openReviewDialog,
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "shift+p",
      handler: handleRequestPause,
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Suggestion editing (s key — like c but pre-sets suggestion type with line content)
    {
      key: "s",
      handler: () => {
        const content = diffViewRef.current?.getSelectedContent() ?? "";
        const range = diffViewRef.current?.getSelectionRange();
        if (range) {
          openSuggestionEditor(range.start, range.end, content);
          diffViewRef.current?.exitVisualMode();
        } else {
          openSuggestionEditor(diffViewRef.current?.getCursorLine() ?? 1, 0, content);
        }
      },
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },

    // File-level comment (Shift+C)
    {
      key: "shift+c",
      handler: () => openCommentEditor(0, 0),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Delete comment at cursor (d key)
    {
      key: "d",
      handler: () => {
        const comment = diffViewRef.current?.getCommentAtCursor();
        if (comment) handleDeleteComment(comment);
      },
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },

    // Toggle comment resolved (x key)
    {
      key: "x",
      handler: () => {
        const comment = diffViewRef.current?.getCommentAtCursor();
        if (comment) handleResolveComment(comment);
      },
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },

    // Force reload (Shift+R)
    {
      key: "shift+r",
      handler: handleForceReload,
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Clear review (Shift+D)
    {
      key: "shift+d",
      handler: handleClearReview,
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Line wrap toggle (w key — works from any pane)
    {
      key: "w",
      handler: () => setWrap((w) => !w),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Focus mode (Shift+F)
    {
      key: "shift+f",
      handler: toggleFocusMode,
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Half-page scroll (Ctrl+D / Ctrl+U — works from any pane)
    {
      key: "ctrl+d",
      handler: () => diffViewRef.current?.scrollHalfPage(1),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "ctrl+u",
      handler: () => diffViewRef.current?.scrollHalfPage(-1),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Horizontal scroll (h/l when main focused, H/L from any pane)
    {
      key: "h",
      handler: () => diffViewRef.current?.scrollHorizontal(-1),
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "l",
      handler: () => diffViewRef.current?.scrollHorizontal(1),
      when: () => focus === "main" && !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "shift+h",
      handler: () => diffViewRef.current?.scrollHorizontal(-1),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "shift+l",
      handler: () => diffViewRef.current?.scrollHorizontal(1),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Scroll position keys (0, ^, $ — works from any pane)
    {
      key: "0",
      handler: () => diffViewRef.current?.scrollToColumn("start"),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "^",
      handler: () => diffViewRef.current?.scrollToColumn("start"),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "$",
      handler: () => diffViewRef.current?.scrollToColumn("end"),
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // {/} — jump between comments (main pane) or sidebar sections (sidebar)
    {
      key: "{",
      handler: () => {
        if (focus === "main") {
          diffViewRef.current?.jumpToComment(-1);
        } else {
          const items = sidebarItemsRef.current;
          for (let i = sidebarCursor - 1; i >= 0; i--) {
            if (items[i]?.kind === "section") {
              const target = Math.min(i + 1, items.length - 1);
              moveSidebarCursorTo(target);
              return;
            }
          }
          moveSidebarCursorTo(0);
        }
      },
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },
    {
      key: "}",
      handler: () => {
        if (focus === "main") {
          diffViewRef.current?.jumpToComment(1);
        } else {
          const items = sidebarItemsRef.current;
          for (let i = sidebarCursor + 1; i < items.length; i++) {
            if (items[i]?.kind === "section") {
              const target = Math.min(i + 1, items.length - 1);
              moveSidebarCursorTo(target);
              return;
            }
          }
          moveSidebarCursorTo(items.length - 1);
        }
      },
      when: () => !commentEditorOpen && !reviewDialogOpen,
    },

    // Base ref picker (b key)
    {
      key: "b",
      handler: () => setBaseRefPickerOpen(true),
      when: () => !commentEditorOpen && !reviewDialogOpen && !helpOpen && !commandPaletteOpen && !baseRefPickerOpen,
    },

    // Connection info (Shift+I)
    {
      key: "shift+i",
      handler: () => setConnectionInfoOpen(true),
      when: () => !commentEditorOpen && !reviewDialogOpen && !helpOpen && !commandPaletteOpen,
    },

    // Help and command palette
    {
      key: "?",
      handler: () => setHelpOpen(true),
      when: () => !commentEditorOpen && !reviewDialogOpen && !helpOpen && !commandPaletteOpen,
    },
    {
      key: ":",
      handler: () => setCommandPaletteOpen(true),
      when: () => !commentEditorOpen && !reviewDialogOpen && !helpOpen && !commandPaletteOpen,
    },
    {
      key: "escape",
      handler: () => {
        if (helpOpen) setHelpOpen(false);
        else if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (diffViewRef.current?.isVisualMode()) diffViewRef.current.exitVisualMode();
      },
      when: () => helpOpen || commandPaletteOpen || (diffViewRef.current?.isVisualMode() ?? false),
    },
  ]);

  // --- Render ---

  return (
    <div className="flex h-full flex-col">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!sidebarHidden && (
          <div className="flex" onClick={() => setFocus("sidebar")}>
            <Sidebar
              ref={sidebarRef}
              files={files}
              contentItems={contentItems}
              additionalFiles={additionalFiles}
              selectedPath={selectedPath}
              selectedContentId={selectedContentId}
              focused={focus === "sidebar"}
              cursor={sidebarCursor}
              reviewFilter={reviewFilter}
              treeMode={treeMode}
              collapseAllSignal={collapseAllSignal}
              expandAllSignal={expandAllSignal}
              onSelect={handleSidebarSelect}
              onCursorChange={setSidebarCursor}
              onItemsChange={handleSidebarItems}
            />
          </div>
        )}

        {/* Main pane */}
        <main
          className={`flex-1 overflow-auto border-r transition-colors duration-150 ${
            focus === "main" ? "border-primary" : "border-transparent"
          }`}
          onClick={() => setFocus("main")}
        >
          {diff ? (
            <DiffView
              ref={diffViewRef}
              diff={diff}
              comments={
                session?.Comments?.filter(
                  (c) => c.TargetRef === (selectedPath || selectedContentId),
                ) ?? []
              }
              viewType={viewType}
              focused={focus === "main"}
              wrap={wrap}
              onFocus={() => setFocus("main")}
              onLineClick={(lineNum) => openCommentEditor(lineNum)}
              onCommentClick={handleEditComment}
            />
          ) : fileContent !== null ? (
            <ContentView
              content={fileContent}
              title={contentTitle || undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-serif">Monocle</p>
                <p className="text-sm mt-2">
                  Select a file to view its diff
                </p>
                <p className="text-xs mt-4 text-muted-foreground/60">
                  j/k to navigate &middot; Tab to switch panes &middot; ? for help
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Status bar */}
      <StatusBar
        session={session}
        subscriberCount={subscriberCount}
        feedbackStatus={feedbackStatus}
        selectedFile={selectedPath || selectedContentId}
      />

      {/* Comment editor dialog */}
      <CommentEditor
        open={commentEditorOpen}
        onClose={() => { setCommentEditorOpen(false); setSuggestionBody(""); }}
        onSave={handleSaveComment}
        editingComment={editingComment}
        initialType={suggestionBody ? "suggestion" : undefined}
        initialBody={suggestionBody || undefined}
        targetLabel={commentTarget?.targetRef ?? ""}
        lineStart={commentTarget?.lineStart ?? 0}
        lineEnd={commentTarget?.lineEnd ?? 0}
      />

      {/* Review submit dialog */}
      <ReviewSubmitDialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        onSubmit={handleSubmitReview}
        onCopyToClipboard={async (action, body) => {
          try {
            const formatted = await api.formatReview(action, body);
            await navigator.clipboard.writeText(formatted);
          } catch (err) {
            console.error("Failed to copy review:", err);
          }
        }}
        summary={reviewSummary}
      />

      {/* Help dialog */}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={handleCommand}
      />

      {/* Connection info dialog */}
      <ConnectionInfoDialog
        open={connectionInfoOpen}
        onClose={() => setConnectionInfoOpen(false)}
      />

      {/* Submission history dialog */}
      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Base ref picker */}
      <BaseRefPicker
        open={baseRefPickerOpen}
        onClose={() => setBaseRefPickerOpen(false)}
        onSelect={handleBaseRefSelect}
      />
    </div>
  );
}

export default App;
