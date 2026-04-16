import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import type { Config } from "../types";

interface SettingsDialogProps {
  open: boolean;
  config: Config | null;
  onClose: () => void;
  onSave: (cfg: Config) => Promise<void> | void;
}

type Draft = Config;

export function SettingsDialog({
  open,
  config,
  onClose,
  onSave,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState<Draft | null>(config);
  const [saving, setSaving] = useState(false);

  // Reset draft whenever the dialog opens with a fresh config.
  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const update = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
    },
    [],
  );

  const updateReviewFormat = useCallback(
    <K extends keyof Draft["review_format"]>(
      key: K,
      value: Draft["review_format"][K],
    ) => {
      setDraft((d) =>
        d
          ? { ...d, review_format: { ...d.review_format, [key]: value } }
          : d,
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        void handleSave();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleSave, onClose],
  );

  if (!draft) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Loading config…</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto -mx-4 px-4 space-y-6">
          <Section title="Appearance">
            <Field label="Sidebar style" hint="Flat list or hierarchical tree.">
              <Select
                value={draft.sidebar_style || "flat"}
                onChange={(v) => update("sidebar_style", v)}
                options={[
                  { value: "flat", label: "Flat" },
                  { value: "tree", label: "Tree" },
                ]}
              />
            </Field>
            <Field
              label="Diff style"
              hint="Default diff rendering when a file is selected."
            >
              <Select
                value={draft.diff_style || "unified"}
                onChange={(v) => update("diff_style", v)}
                options={[
                  { value: "unified", label: "Unified" },
                  { value: "split", label: "Split" },
                  { value: "file", label: "Full file" },
                ]}
              />
            </Field>
            <Field
              label="Layout"
              hint="Auto responds to window width; side-by-side and stacked force an orientation."
            >
              <Select
                value={draft.layout || "auto"}
                onChange={(v) => update("layout", v)}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "side-by-side", label: "Side-by-side" },
                  { value: "stacked", label: "Stacked" },
                ]}
              />
            </Field>
            <Field
              label="Minimum diff width"
              hint="In auto layout, stack vertically when the window is narrower than this (columns)."
            >
              <NumberInput
                value={draft.min_diff_width || 80}
                onChange={(v) => update("min_diff_width", v)}
                min={40}
                max={300}
              />
            </Field>
          </Section>

          <Section title="Diff rendering">
            <Toggle
              label="Wrap long lines"
              hint="Soft-wrap lines that exceed the pane width."
              checked={draft.wrap}
              onChange={(v) => update("wrap", v)}
            />
            <Field label="Tab size" hint="Spaces per tab character.">
              <NumberInput
                value={draft.tab_size || 4}
                onChange={(v) => update("tab_size", v)}
                min={1}
                max={16}
              />
            </Field>
            <Field
              label="Context lines"
              hint="Unchanged lines shown around each hunk."
            >
              <NumberInput
                value={draft.context_lines ?? 3}
                onChange={(v) => update("context_lines", v)}
                min={0}
                max={20}
              />
            </Field>
          </Section>

          <Section title="Review workflow">
            <Toggle
              label="Auto-enter focus mode on plans"
              hint="Hide the sidebar and enable wrap when selecting a plan."
              checked={draft.auto_focus_mode}
              onChange={(v) => update("auto_focus_mode", v)}
            />
            <Field
              label="Mark reviewed on submit"
              hint="Which files to auto-mark reviewed when you submit."
            >
              <Select
                value={draft.mark_reviewed_on_submit || "all"}
                onChange={(v) => update("mark_reviewed_on_submit", v)}
                options={[
                  { value: "all", label: "All files" },
                  { value: "commented", label: "Only commented files" },
                  { value: "manual", label: "None (manual only)" },
                ]}
              />
            </Field>
          </Section>

          <Section title="Review formatting">
            <Toggle
              label="Include code snippets"
              hint="Embed the commented lines inline in submitted reviews."
              checked={draft.review_format.include_snippets}
              onChange={(v) => updateReviewFormat("include_snippets", v)}
            />
            <Field
              label="Max snippet lines"
              hint="Truncate snippets longer than this."
            >
              <NumberInput
                value={draft.review_format.max_snippet_lines || 10}
                onChange={(v) => updateReviewFormat("max_snippet_lines", v)}
                min={1}
                max={100}
              />
            </Field>
            <Toggle
              label="Include summary counts"
              hint="Add issue/suggestion/note totals at the top of the review."
              checked={draft.review_format.include_summary}
              onChange={(v) => updateReviewFormat("include_summary", v)}
            />
          </Section>

          <Section title="Ignore patterns">
            <p className="text-[11px] text-muted-foreground mb-2">
              Glob patterns to hide from the diff list (one per line).
            </p>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-border bg-input/30 px-2 py-1.5 text-xs font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 resize-y"
              value={(draft.ignore_patterns ?? []).join("\n")}
              onChange={(e) =>
                update(
                  "ignore_patterns",
                  e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                )
              }
              placeholder={"*.lock\ndist/**\nnode_modules/**"}
            />
          </Section>

          <p className="text-[10px] text-muted-foreground pt-2">
            Keybindings are edited in your config file ({" "}
            <span className="font-mono">~/.config/monocle/config.json</span>).
            Changes are saved to the same file.
          </p>
        </div>

        <DialogFooter className="items-center">
          <span className="text-[10px] text-muted-foreground sm:mr-auto">
            ⌘S to save &middot; Esc to cancel
          </span>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Form primitives (local; intentionally small) ---

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ctp-sky mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        {hint && (
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        {hint && (
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        )}
      </div>
      <span
        onClick={() => onChange(!checked)}
        className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-ctp-surface2"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-44 rounded-md border border-border bg-input/30 px-2 py-1 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-popover">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="w-20 rounded-md border border-border bg-input/30 px-2 py-1 text-xs text-right outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    />
  );
}
