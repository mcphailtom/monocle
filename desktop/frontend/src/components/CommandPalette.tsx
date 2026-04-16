import { useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./ui/command";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
}

const COMMANDS = [
  { value: "submit", label: "Submit review", group: "Review" },
  { value: "submit-auto", label: "Submit review (auto — skip dialog)", group: "Review" },
  { value: "pause", label: "Request pause", group: "Review" },
  { value: "unpause", label: "Cancel pause", group: "Review" },
  { value: "clear", label: "Clear all comments", group: "Review" },
  { value: "mark-all-reviewed", label: "Mark all files reviewed", group: "Review" },
  { value: "mark-all-unreviewed", label: "Mark all files unreviewed", group: "Review" },
  { value: "discard", label: "Discard review", group: "Review" },
  { value: "pick-version", label: "Select base version (content item)", group: "Content" },
  { value: "cycle-layout", label: "Cycle layout (auto / side-by-side / stacked)", group: "View" },
  { value: "history", label: "View submission history", group: "Session" },
];

export function CommandPalette({
  open,
  onClose,
  onCommand,
}: CommandPaletteProps) {
  const handleSelect = useCallback(
    (value: string) => {
      onCommand(value);
      onClose();
    },
    [onCommand, onClose],
  );

  const groups = COMMANDS.reduce(
    (acc, cmd) => {
      if (!acc[cmd.group]) acc[cmd.group] = [];
      acc[cmd.group].push(cmd);
      return acc;
    },
    {} as Record<string, typeof COMMANDS>,
  );

  return (
    <CommandDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        {Object.entries(groups).map(([group, cmds]) => (
          <CommandGroup key={group} heading={group}>
            {cmds.map((cmd) => (
              <CommandItem
                key={cmd.value}
                value={cmd.value}
                onSelect={() => handleSelect(cmd.value)}
              >
                <span className="text-xs">{cmd.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
