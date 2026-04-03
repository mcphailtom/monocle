import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ScrollArea } from "./ui/scroll-area";
import type {
  ChangedFile,
  ContentItem,
  AdditionalFile,
  FileChangeStatus,
} from "../types";

// --- Types ---

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  file?: ChangedFile;
}

type SidebarItem =
  | { kind: "content"; item: ContentItem }
  | { kind: "file"; file: ChangedFile }
  | { kind: "additional"; file: AdditionalFile }
  | { kind: "dir"; path: string; depth: number; collapsed: boolean }
  | { kind: "tree-file"; file: ChangedFile; depth: number }
  | { kind: "section"; label: string; count: number };

interface SidebarProps {
  files: ChangedFile[];
  contentItems: ContentItem[];
  additionalFiles: AdditionalFile[];
  selectedPath: string;
  selectedContentId: string;
  focused: boolean;
  cursor: number;
  reviewFilter: string;
  treeMode: boolean;
  onSelect: (item: SidebarItem) => void;
  onCursorChange: (cursor: number) => void;
  onItemsChange?: (items: SidebarItem[]) => void;
}

// --- Helpers ---

const STATUS_LABELS: Record<FileChangeStatus, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  none: "",
};

const STATUS_COLORS: Record<FileChangeStatus, string> = {
  added: "text-status-added",
  modified: "text-status-modified",
  deleted: "text-status-deleted",
  renamed: "text-status-renamed",
  none: "text-muted-foreground",
};

function buildTree(files: ChangedFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const dirs = new Map<string, FileTreeNode>();

  for (const file of files) {
    const parts = file.Path.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (currentPath ? "/" : "") + parts[i];
      let dir = dirs.get(currentPath);
      if (!dir) {
        dir = { name: parts[i], path: currentPath, isDir: true, children: [] };
        dirs.set(currentPath, dir);
        current.push(dir);
      }
      current = dir.children;
    }

    current.push({
      name: parts[parts.length - 1],
      path: file.Path,
      isDir: false,
      children: [],
      file,
    });
  }

  return root;
}

function flattenTree(
  nodes: FileTreeNode[],
  collapsed: Set<string>,
  depth: number = 0,
): SidebarItem[] {
  const items: SidebarItem[] = [];
  for (const node of nodes) {
    if (node.isDir) {
      const isCollapsed = collapsed.has(node.path);
      items.push({ kind: "dir", path: node.path, depth, collapsed: isCollapsed });
      if (!isCollapsed) {
        items.push(...flattenTree(node.children, collapsed, depth + 1));
      }
    } else if (node.file) {
      items.push({ kind: "tree-file", file: node.file, depth });
    }
  }
  return items;
}

function filterByReview<T extends { Reviewed: boolean }>(
  items: T[],
  filter: string,
): T[] {
  if (filter === "reviewed") return items.filter((f) => !f.Reviewed);
  if (filter === "unreviewed") return items.filter((f) => f.Reviewed);
  return items;
}

// --- Component ---

export function Sidebar({
  files,
  contentItems,
  additionalFiles,
  selectedPath,
  selectedContentId,
  focused,
  cursor,
  reviewFilter,
  treeMode,
  onSelect,
  onCursorChange,
  onItemsChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const filteredFiles = useMemo(
    () => filterByReview(files, reviewFilter),
    [files, reviewFilter],
  );

  const filteredContent = useMemo(
    () => filterByReview(contentItems, reviewFilter),
    [contentItems, reviewFilter],
  );

  const filteredAdditional = useMemo(
    () => filterByReview(additionalFiles, reviewFilter),
    [additionalFiles, reviewFilter],
  );

  const tree = useMemo(
    () => (treeMode ? buildTree(filteredFiles) : []),
    [filteredFiles, treeMode],
  );

  const items = useMemo((): SidebarItem[] => {
    const result: SidebarItem[] = [];

    // Content items section
    if (filteredContent.length > 0) {
      result.push({
        kind: "section",
        label: "Review Items",
        count: filteredContent.length,
      });
      for (const item of filteredContent) {
        result.push({ kind: "content", item });
      }
    }

    // Changed files section
    if (filteredFiles.length > 0) {
      result.push({
        kind: "section",
        label: "Changed Files",
        count: filteredFiles.length,
      });
      if (treeMode) {
        result.push(...flattenTree(tree, collapsed));
      } else {
        for (const file of filteredFiles) {
          result.push({ kind: "file", file });
        }
      }
    }

    // Additional files section
    if (filteredAdditional.length > 0) {
      result.push({
        kind: "section",
        label: "Additional Files",
        count: filteredAdditional.length,
      });
      for (const file of filteredAdditional) {
        result.push({ kind: "additional", file });
      }
    }

    return result;
  }, [filteredContent, filteredFiles, filteredAdditional, treeMode, tree, collapsed]);

  // Notify parent when items change so keyboard nav can resolve cursor → item
  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current.get(cursor);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [cursor]);

  const toggleDir = useCallback(
    (path: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [],
  );

  const handleClick = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;

      if (item.kind === "section") return;

      if (item.kind === "dir") {
        toggleDir(item.path);
        return;
      }

      onCursorChange(index);
      onSelect(item);
    },
    [items, onSelect, onCursorChange, toggleDir],
  );

  const selectableCount = items.filter(
    (i) => i.kind !== "section",
  ).length;

  return (
    <aside
      className={`flex flex-col border-r overflow-hidden ${
        focused ? "border-primary" : "border-border"
      }`}
      style={{ width: 260 }}
    >
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="py-1">
          {items.map((item, index) => (
            <SidebarRow
              key={`${item.kind}-${index}`}
              item={item}
              index={index}
              isActive={isSidebarItemSelected(item, selectedPath, selectedContentId)}
              isCursor={focused && index === cursor}
              onClick={handleClick}
              setRef={(el) => {
                if (el) itemRefs.current.set(index, el);
                else itemRefs.current.delete(index);
              }}
            />
          ))}
          {selectableCount === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No files to show
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function isSidebarItemSelected(
  item: SidebarItem,
  selectedPath: string,
  selectedContentId: string,
): boolean {
  switch (item.kind) {
    case "file":
    case "tree-file":
      return item.file.Path === selectedPath;
    case "content":
      return item.item.ID === selectedContentId;
    case "additional":
      return item.file.Path === selectedPath;
    default:
      return false;
  }
}

// --- Row ---

interface SidebarRowProps {
  item: SidebarItem;
  index: number;
  isActive: boolean;
  isCursor: boolean;
  onClick: (index: number) => void;
  setRef: (el: HTMLDivElement | null) => void;
}

function SidebarRow({
  item,
  index,
  isActive,
  isCursor,
  onClick,
  setRef,
}: SidebarRowProps) {
  if (item.kind === "section") {
    return (
      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {item.label}
        <span className="ml-1 text-muted-foreground/60">{item.count}</span>
      </div>
    );
  }

  const indent =
    item.kind === "dir" || item.kind === "tree-file" ? item.depth * 12 : 0;

  let label: string;
  let status: FileChangeStatus | null = null;
  let reviewed = false;
  let icon = "";

  switch (item.kind) {
    case "file":
    case "tree-file":
      label = item.kind === "tree-file" ? item.file.Path.split("/").pop()! : item.file.Path;
      status = item.file.Status;
      reviewed = item.file.Reviewed;
      break;
    case "content":
      label = item.item.Title;
      reviewed = item.item.Reviewed;
      icon = item.item.IsPlan ? "P" : "D";
      break;
    case "additional":
      label = item.file.Name;
      reviewed = item.file.Reviewed;
      break;
    case "dir":
      label = item.path.split("/").pop()!;
      icon = item.collapsed ? "\u25B6" : "\u25BC"; // ▶ or ▼
      break;
  }

  return (
    <div
      ref={setRef}
      className={`flex items-center gap-1 px-3 py-0.5 cursor-pointer text-sm truncate ${
        isActive
          ? "bg-accent text-accent-foreground"
          : isCursor
            ? "bg-secondary text-secondary-foreground"
            : "text-foreground hover:bg-secondary/50"
      } ${reviewed ? "opacity-50" : ""}`}
      style={{ paddingLeft: `${12 + indent}px` }}
      onClick={() => onClick(index)}
    >
      {icon && (
        <span className="text-[10px] text-muted-foreground w-3 shrink-0">
          {icon}
        </span>
      )}
      <span className="truncate">{label}</span>
      {status && (
        <span className={`ml-auto text-[10px] shrink-0 ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      )}
      {reviewed && (
        <span className="ml-auto text-[10px] text-ctp-green shrink-0">
          ✓
        </span>
      )}
    </div>
  );
}

export type { SidebarItem };
