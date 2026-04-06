import { useState, useEffect, useRef, useCallback } from "react";
import { FolderOpen, ChevronDown } from "lucide-react";
import { api } from "../api";
import type { RecentProject } from "../types";

interface ToolbarProps {
  projectPath: string;
  subscriberCount: number;
  connectionMode: string;
  feedbackStatus: string;
  onSelectProject: (path: string) => void;
}

export function Toolbar({ projectPath, subscriberCount, connectionMode, feedbackStatus, onSelectProject }: ToolbarProps) {
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

  return (
    <div
      className="flex items-center h-[52px] px-4 border-b border-border shrink-0 drag-region"
    >
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

      {/* Right side: connection status (matches TUI statusbar.go) */}
      {(() => {
        const isConnected = subscriberCount > 0 || connectionMode === "queue";
        return (
          <div className="ml-auto flex items-center gap-1.5 no-drag text-[12px]">
            {feedbackStatus === "waiting" ? (
              <>
                <span className={isConnected ? "text-ctp-yellow" : "text-ctp-yellow/60"}>
                  {isConnected ? "●" : "○"}
                </span>
                <span className="text-ctp-yellow">Waiting for Review</span>
              </>
            ) : isConnected ? (
              <>
                <span className="text-ctp-green">●</span>
                <span className="text-ctp-green">Connected</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">○</span>
                <span className="text-muted-foreground">Waiting</span>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
