import { useEffect, useState, useCallback } from "react";
import { api, onEvent } from "./api";
import { Sidebar, type SidebarItem } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { DiffView } from "./components/DiffView";
import { ContentView } from "./components/ContentView";
import { CommentEditor } from "./components/CommentEditor";
import { ReviewSubmitDialog } from "./components/ReviewSubmitDialog";
import { HelpDialog } from "./components/HelpDialog";
import { CommandPalette } from "./components/CommandPalette";
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

  // Comment editor state
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{
    targetType: TargetType;
    targetRef: string;
    lineStart: number;
    lineEnd: number;
  } | null>(null);
  const [editingComment, setEditingComment] = useState<ReviewComment | null>(null);

  // Review submit state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);

  // Help and command palette
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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
    (lineStart: number, lineEnd: number = 0) => {
      const targetType: TargetType = selectedContentId ? "content" : "file";
      const targetRef = selectedContentId || selectedPath;
      if (!targetRef) return;

      setCommentTarget({ targetType, targetRef, lineStart, lineEnd: lineEnd || lineStart });
      setEditingComment(null);
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
        case "history":
          // TODO: implement history view
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
      handler: () =>
        setSidebarCursor((c) => Math.min(c + 1, getTotalItems() - 1)),
      when: () => focus === "sidebar",
    },
    {
      key: "k",
      handler: () => setSidebarCursor((c) => Math.max(c - 1, 0)),
      when: () => focus === "sidebar",
    },
    {
      key: "g",
      handler: () => setSidebarCursor(0),
      when: () => focus === "sidebar",
    },
    {
      key: "shift+g",
      handler: () => setSidebarCursor(getTotalItems() - 1),
      when: () => focus === "sidebar",
    },

    // Sidebar toggles
    {
      key: "f",
      handler: () => setTreeMode((t) => !t),
      when: () => focus === "sidebar",
    },
    {
      key: "/",
      handler: () =>
        setReviewFilter((f) =>
          f === "" ? "reviewed" : f === "reviewed" ? "unreviewed" : "",
        ),
      when: () => focus === "sidebar",
    },

    // File navigation (global)
    {
      key: "[",
      handler: () => setSidebarCursor((c) => Math.max(c - 1, 0)),
    },
    {
      key: "]",
      handler: () =>
        setSidebarCursor((c) => Math.min(c + 1, getTotalItems() - 1)),
    },

    // Diff view controls (when main pane focused)
    {
      key: "t",
      handler: () =>
        setViewType((v) => (v === "unified" ? "split" : "unified")),
      when: () => focus === "main",
    },

    // Commenting (when main pane focused, no dialog open)
    {
      key: "c",
      handler: () => openCommentEditor(1),
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
      },
      when: () => helpOpen || commandPaletteOpen,
    },
  ]);

  function getTotalItems(): number {
    return (
      files.length +
      contentItems.length +
      additionalFiles.length +
      // approximate — sections are non-navigable but counted in the flat list
      10
    );
  }

  // --- Render ---

  return (
    <div className="flex h-full flex-col">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!sidebarHidden && (
          <Sidebar
            files={files}
            contentItems={contentItems}
            additionalFiles={additionalFiles}
            selectedPath={selectedPath}
            selectedContentId={selectedContentId}
            focused={focus === "sidebar"}
            cursor={sidebarCursor}
            reviewFilter={reviewFilter}
            treeMode={treeMode}
            onSelect={handleSidebarSelect}
            onCursorChange={setSidebarCursor}
          />
        )}

        {/* Main pane */}
        <main
          className={`flex-1 overflow-auto border-r ${
            focus === "main" ? "border-primary" : "border-transparent"
          }`}
        >
          {diff ? (
            <DiffView
              diff={diff}
              comments={
                session?.Comments?.filter(
                  (c) => c.TargetRef === (selectedPath || selectedContentId),
                ) ?? []
              }
              viewType={viewType}
              focused={focus === "main"}
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
                <p className="text-lg">Monocle</p>
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
        onClose={() => setCommentEditorOpen(false)}
        onSave={handleSaveComment}
        editingComment={editingComment}
        targetLabel={commentTarget?.targetRef ?? ""}
        lineStart={commentTarget?.lineStart ?? 0}
        lineEnd={commentTarget?.lineEnd ?? 0}
      />

      {/* Review submit dialog */}
      <ReviewSubmitDialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        onSubmit={handleSubmitReview}
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
    </div>
  );
}

export default App;
