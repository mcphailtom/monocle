interface ToolbarProps {
  projectPath: string;
  subscriberCount: number;
}

export function Toolbar({ projectPath, subscriberCount }: ToolbarProps) {
  const projectName = projectPath.split("/").pop() || "Monocle";

  return (
    <div
      className="flex items-center h-[52px] px-4 border-b border-border shrink-0 drag-region"
    >
      <div className="flex items-center no-drag">
        {/* Project name */}
        <span className="text-[13px] text-foreground font-medium">
          {projectName}
        </span>
      </div>

      {/* Right side: connection indicator */}
      <div className="ml-auto flex items-center gap-2 no-drag">
        <span
          className={`inline-block w-2 h-2 rounded-full transition-colors duration-300 ${
            subscriberCount > 0
              ? "bg-ctp-green shadow-[0_0_6px_var(--color-ctp-green)]"
              : "bg-ctp-surface2"
          }`}
          title={subscriberCount > 0 ? "Agent connected" : "No agent connected"}
        />
      </div>
    </div>
  );
}
