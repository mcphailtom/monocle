import { useState, useEffect, useRef, useCallback } from "react";
import { FolderOpen, ChevronDown } from "lucide-react";
import { api } from "../api";
import type { RecentProject } from "../types";

interface ToolbarProps {
  projectPath: string;
  subscriberCount: number;
  connectionMode: string;
  feedbackStatus: string;
  socketStarted: boolean;
  waitingForReview: boolean;
  agentName: string;
  sidebarHidden: boolean;
  onSelectProject: (path: string) => void;
}

type ConnState =
  | { kind: "disconnected" }
  | { kind: "waiting" } // socket ready, no agent
  | { kind: "connected"; agent: string }
  | { kind: "waiting_for_review"; connected: boolean };

function deriveConnState(p: {
  subscriberCount: number;
  connectionMode: string;
  feedbackStatus: string;
  socketStarted: boolean;
  waitingForReview: boolean;
  agentName: string;
}): ConnState {
  const connected = p.subscriberCount > 0 || p.connectionMode === "queue";
  if (p.waitingForReview || p.feedbackStatus === "waiting") {
    return { kind: "waiting_for_review", connected };
  }
  if (connected) {
    return { kind: "connected", agent: p.agentName };
  }
  if (p.socketStarted) {
    return { kind: "waiting" };
  }
  return { kind: "disconnected" };
}

export function Toolbar({
  projectPath,
  subscriberCount,
  connectionMode,
  feedbackStatus,
  socketStarted,
  waitingForReview,
  agentName,
  sidebarHidden,
  onSelectProject,
}: ToolbarProps) {
  const projectName = projectPath.split("/").pop() || "Monocle";
  const [open, setOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent projects when dropdown opens
  useEffect(() => {
    if (!open) return;
    api.getRecentProjects().then((projects) => {
      setRecentProjects(projects ?? []);
    });
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      if (path !== projectPath) {
        onSelectProject(path);
      }
    },
    [projectPath, onSelectProject],
  );

  const handleOpenFolder = useCallback(async () => {
    setOpen(false);
    try {
      const path = await api.openDirectoryDialog();
      if (path) onSelectProject(path);
    } catch (err) {
      console.error("Failed to open directory dialog:", err);
    }
  }, [onSelectProject]);

  const conn = deriveConnState({
    subscriberCount,
    connectionMode,
    feedbackStatus,
    socketStarted,
    waitingForReview,
    agentName,
  });

  return (
    <div
      className={`flex items-center h-[52px] px-4 border-b border-border shrink-0 drag-region ${sidebarHidden ? "pl-[88px]" : ""}`}
    >
      {/* Logotype — shown when sidebar is hidden (focus mode) to fill the traffic light area */}
      {sidebarHidden && (
        <span
          className="no-drag text-[13px] font-semibold select-none text-ctp-blue mr-3"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          o_(<span className="text-ctp-lavender">&#x25C9;</span>) monocle
        </span>
      )}

      {/* Focus mode badge */}
      {sidebarHidden && (
        <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-ctp-mauve/20 text-ctp-mauve mr-3 no-drag">
          Focus Mode
        </span>
      )}

      {/* Project switcher */}
      <div className="relative no-drag" ref={dropdownRef}>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-secondary/50 transition-colors duration-150"
          onClick={() => setOpen((o) => !o)}
        >
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px] text-foreground font-medium">
            {projectName}
          </span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="py-1">
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors duration-100 hover:bg-accent ${
                    project.path === projectPath ? "bg-accent/50" : ""
                  }`}
                  onClick={() => handleSelect(project.path)}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground font-medium truncate">
                      {project.name}
                    </span>
                    {project.path === projectPath && (
                      <span className="ml-auto text-ctp-blue text-xs shrink-0">current</span>
                    )}
                  </div>
                  <div className="ml-[22px] text-xs text-muted-foreground truncate font-mono">
                    {project.path}
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-border">
              <button
                className="w-full text-left px-3 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-100"
                onClick={handleOpenFolder}
              >
                Open Folder...
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Connection status — 4-state matrix matching TUI statusbar.go */}
      <div className="ml-auto flex items-center gap-1.5 no-drag text-[12px]">
        {conn.kind === "disconnected" && (
          <>
            <span className="text-ctp-red">●</span>
            <span className="text-ctp-red">Disconnected</span>
          </>
        )}
        {conn.kind === "waiting" && (
          <>
            <span className="text-muted-foreground">○</span>
            <span className="text-muted-foreground">Waiting</span>
          </>
        )}
        {conn.kind === "connected" && (
          <>
            <span className="text-ctp-green">●</span>
            <span className="text-ctp-green">Connected</span>
            {conn.agent && (
              <span className="text-ctp-green/80">&middot; {conn.agent}</span>
            )}
          </>
        )}
        {conn.kind === "waiting_for_review" && (
          <>
            <span
              className={
                conn.connected ? "text-ctp-yellow" : "text-ctp-yellow/60"
              }
            >
              {conn.connected ? "●" : "○"}
            </span>
            <span className="text-ctp-yellow">Waiting for Review</span>
          </>
        )}
      </div>
    </div>
  );
}
