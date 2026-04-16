// Maps user-configurable action names (matching internal/tui/keys.go) to
// keyboard shortcut strings understood by the useKeyboard hook.

import type { Config } from "../types";

export type KeyAction =
  // Navigation
  | "up"
  | "down"
  | "top"
  | "bottom"
  | "half_up"
  | "half_down"
  | "prev_file"
  | "next_file"
  // Pane focus
  | "focus_swap"
  | "focus_sidebar"
  | "focus_main"
  | "toggle_sidebar"
  // Diff view
  | "scroll_down"
  | "scroll_up"
  | "scroll_left"
  | "scroll_right"
  | "scroll_home"
  | "scroll_first_char"
  | "scroll_end"
  | "wrap"
  | "toggle_diff"
  // Sidebar
  | "tree_mode"
  | "collapse_all"
  | "expand_all"
  | "prev_section"
  | "next_section"
  | "filter_reviewed"
  // Review
  | "comment"
  | "file_comment"
  | "suggest"
  | "visual"
  | "reviewed"
  | "delete_comment"
  | "resolve_comment"
  | "submit"
  | "pause"
  | "clear_review"
  | "toggle_focus_mode"
  | "connection_info"
  // General
  | "open_in_editor"
  | "base_ref"
  | "artifact_versions"
  | "cycle_layout"
  | "refresh"
  | "help"
  | "command_mode";

export const DEFAULT_KEYMAP: Record<KeyAction, string> = {
  up: "k",
  down: "j",
  top: "g",
  bottom: "shift+g",
  half_up: "ctrl+u",
  half_down: "ctrl+d",
  prev_file: "[",
  next_file: "]",
  focus_swap: "tab",
  focus_sidebar: "1",
  focus_main: "2",
  toggle_sidebar: "\\",
  scroll_down: "shift+j",
  scroll_up: "shift+k",
  scroll_left: "shift+h",
  scroll_right: "shift+l",
  scroll_home: "0",
  scroll_first_char: "^",
  scroll_end: "$",
  wrap: "w",
  toggle_diff: "t",
  tree_mode: "f",
  collapse_all: "z",
  expand_all: "e",
  prev_section: "{",
  next_section: "}",
  filter_reviewed: "/",
  comment: "c",
  file_comment: "shift+c",
  suggest: "s",
  visual: "v",
  reviewed: "r",
  delete_comment: "d",
  resolve_comment: "x",
  submit: "shift+s",
  pause: "shift+p",
  clear_review: "shift+d",
  toggle_focus_mode: "shift+f",
  connection_info: "shift+i",
  open_in_editor: "ctrl+g",
  base_ref: "b",
  artifact_versions: "shift+b",
  cycle_layout: "shift+t",
  refresh: "shift+r",
  help: "?",
  command_mode: ":",
};

/**
 * Merge a user's config.keybindings overrides onto the default keymap.
 * Keys present in the config override the defaults. Unknown actions are
 * ignored so old configs don't break newer builds.
 */
export function resolveKeymap(
  cfg: Pick<Config, "keybindings"> | null | undefined,
): Record<KeyAction, string> {
  const merged = { ...DEFAULT_KEYMAP };
  const overrides = cfg?.keybindings ?? {};
  for (const [action, key] of Object.entries(overrides)) {
    if (action in merged && typeof key === "string" && key !== "") {
      merged[action as KeyAction] = key;
    }
  }
  return merged;
}
