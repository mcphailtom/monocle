import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { RecentProject } from "../types";

interface ProjectPickerProps {
  onSelect: (path: string) => void;
  error: string | null;
}

export function ProjectPicker({ onSelect, error }: ProjectPickerProps) {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  // Reset selecting state when an error comes back
  useEffect(() => {
    if (error) setSelecting(false);
  }, [error]);

  useEffect(() => {
    async function load() {
      try {
        const projects = await api.getRecentProjects();
        setRecentProjects(projects ?? []);
      } catch {
        // Bindings not ready
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleOpenFolder = useCallback(async () => {
    try {
      const path = await api.openDirectoryDialog();
      if (path) {
        setSelecting(true);
        onSelect(path);
      }
    } catch (err) {
      console.error("Failed to open directory dialog:", err);
    }
  }, [onSelect]);

  const handleSelectRecent = useCallback(
    (path: string) => {
      setSelecting(true);
      onSelect(path);
    },
    [onSelect],
  );

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "today";
      if (diffDays === 1) return "yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

  if (selecting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Opening project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif text-foreground mb-1">Monocle</h1>
          <p className="text-sm text-muted-foreground">
            Select a project to review
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded border border-destructive/50 bg-destructive/10 text-destructive text-xs">
            {error}
          </div>
        )}

        {/* Open folder button */}
        <Button
          variant="outline"
          className="w-full mb-4 h-12 text-sm"
          onClick={handleOpenFolder}
        >
          Open Folder...
        </Button>

        {/* Recent projects */}
        {!loading && recentProjects.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Recent Projects
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {recentProjects.map((project) => (
                  <button
                    key={project.path}
                    className="w-full text-left px-3 py-2 rounded hover:bg-secondary/50 transition-all duration-200"
                    onClick={() => handleSelectRecent(project.path)}
                  >
                    <div className="text-sm text-foreground font-medium">
                      {project.name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="truncate font-mono">{project.path}</span>
                      <span className="shrink-0">&middot;</span>
                      <span className="shrink-0">
                        {formatDate(project.last_opened)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {!loading && recentProjects.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            No recent projects. Open a folder to get started.
          </p>
        )}
      </div>
    </div>
  );
}
