import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface RegisterMCPDialogProps {
  open: boolean;
  onClose: () => void;
  onRegister: (global: boolean) => Promise<void> | void;
}

type Scope = "local" | "global";

export function RegisterMCPDialog({ open, onClose, onRegister }: RegisterMCPDialogProps) {
  const [scope, setScope] = useState<Scope>("local");

  const handleRegister = useCallback(async () => {
    await onRegister(scope === "global");
  }, [scope, onRegister]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setScope((s) => (s === "local" ? "global" : "local"));
      } else if (e.key === "Enter") {
        e.preventDefault();
        void handleRegister();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleRegister, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Register MCP Channel</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Monocle's MCP channel is not registered. This is needed to directly
          communicate with Claude Code during reviews.
        </p>

        <div className="flex gap-2">
          <button
            className={`flex-1 px-3 py-2 text-xs rounded border text-left ${
              scope === "local"
                ? "border-ctp-yellow/50 bg-ctp-yellow/10 text-ctp-yellow"
                : "border-border text-muted-foreground hover:bg-secondary/50"
            }`}
            onClick={() => setScope("local")}
          >
            <div className="font-semibold uppercase tracking-wider text-[10px]">
              Local
            </div>
            <div className="font-mono text-[11px] opacity-80">./.mcp.json</div>
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs rounded border text-left ${
              scope === "global"
                ? "border-ctp-blue/50 bg-ctp-blue/10 text-ctp-blue"
                : "border-border text-muted-foreground hover:bg-secondary/50"
            }`}
            onClick={() => setScope("global")}
          >
            <div className="font-semibold uppercase tracking-wider text-[10px]">
              Global
            </div>
            <div className="font-mono text-[11px] opacity-80">~/.mcp.json</div>
          </button>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] text-muted-foreground">
              Tab to cycle scope &middot; Enter to register &middot; Esc to skip
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Skip
              </Button>
              <Button size="sm" onClick={() => void handleRegister()}>
                Register
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
