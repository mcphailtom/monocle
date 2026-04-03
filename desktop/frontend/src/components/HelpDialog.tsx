import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "Navigation",
    bindings: [
      ["j / k", "Move cursor up/down"],
      ["g g / G", "Go to top / bottom"],
      ["Ctrl+U / Ctrl+D", "Half page up / down"],
      ["[ / ]", "Previous / next file"],
      ["Tab", "Switch focus between sidebar and main pane"],
      ["\\", "Toggle sidebar"],
      ["1 / 2", "Focus sidebar / main pane"],
    ],
  },
  {
    title: "Sidebar",
    bindings: [
      ["f", "Toggle tree/flat view"],
      ["/", "Cycle review filter (all / hide reviewed / hide unreviewed)"],
    ],
  },
  {
    title: "Diff View",
    bindings: [
      ["t", "Toggle unified/split diff view"],
    ],
  },
  {
    title: "Commenting & Review",
    bindings: [
      ["c", "Add comment on current line"],
      ["r", "Toggle file/content reviewed"],
      ["S", "Open submit review dialog"],
      ["P", "Request pause"],
      [":", "Open command palette"],
    ],
  },
  {
    title: "Comment Editor",
    bindings: [
      ["Tab", "Cycle comment type"],
      ["Ctrl+Enter", "Save comment"],
      ["Escape", "Cancel"],
    ],
  },
  {
    title: "General",
    bindings: [
      ["?", "Show this help"],
      ["Escape", "Close dialog / cancel"],
    ],
  },
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {section.bindings.map(([key, desc]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <kbd className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[11px] font-mono">
                        {key}
                      </kbd>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
