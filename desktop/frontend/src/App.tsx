import { useEffect, useState, useCallback } from "react";
import { api, onEvent } from "./api";
import { Sidebar, type SidebarItem } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { useKeyboard } from "./hooks/useKeyboard";
import type {
  ReviewSession,
  ChangedFile,
  ContentItem,
  AdditionalFile,
  DiffResult,
} from "./types";

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
            <DiffPlaceholder diff={diff} />
          ) : fileContent !== null ? (
            <ContentPlaceholder content={fileContent} />
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
    </div>
  );
}

// Temporary placeholders — replaced in Phase 3
function DiffPlaceholder({ diff }: { diff: DiffResult }) {
  const totalLines = diff.Hunks.reduce((sum, h) => sum + h.Lines.length, 0);
  return (
    <div className="p-4">
      <div className="text-sm text-muted-foreground mb-2">
        {diff.Path} &middot; {diff.Hunks.length} hunk
        {diff.Hunks.length !== 1 ? "s" : ""} &middot; {totalLines} lines
      </div>
      <div className="font-mono text-xs selectable">
        {diff.Hunks.map((hunk, hi) => (
          <div key={hi} className="mb-4">
            <div className="text-diff-hunk opacity-60">{hunk.Header}</div>
            {hunk.Lines.map((line, li) => (
              <div
                key={li}
                className={
                  line.Kind === "added"
                    ? "text-diff-added bg-diff-added-bg"
                    : line.Kind === "removed"
                      ? "text-diff-removed bg-diff-removed-bg"
                      : "text-foreground"
                }
              >
                <span className="inline-block w-16 text-right text-muted-foreground/40 select-none pr-2">
                  {line.OldLineNum > 0 ? line.OldLineNum : " "}
                  {" "}
                  {line.NewLineNum > 0 ? line.NewLineNum : " "}
                </span>
                <span className="select-none">
                  {line.Kind === "added" ? "+" : line.Kind === "removed" ? "-" : " "}
                </span>
                {line.Content}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentPlaceholder({ content }: { content: string }) {
  return (
    <div className="p-4">
      <pre className="font-mono text-xs text-foreground whitespace-pre-wrap selectable">
        {content}
      </pre>
    </div>
  );
}

export default App;
