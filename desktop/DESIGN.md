# Desktop Design System

Visual and interaction design decisions for the Monocle desktop app. Reference this before making UI changes.

## Window Chrome

- **Frameless window** using Wails `TitleBarHiddenInset()` — no native title bar, native traffic light buttons (close/minimize/zoom) are preserved
- **Traffic lights repositioned** via CGO (`traffic_lights_darwin.go`) to vertically center at 26px from window top, aligning with toolbar content. Notification observers keep position stable across resizes and focus changes
- **Dark appearance enforced** with `NSAppearanceNameDarkAqua`
- **No native focus outlines** — all browser/WebView focus rings disabled globally in CSS (`outline: none !important` on `*`, `*:focus`, `*:focus-visible`). Focus state is managed manually

## Layout Structure

```
┌──────────────┬────────────────────────────────┐
│ [traffic     │  Toolbar (project switcher)    │
│  lights]     │                                │
│ logotype     ├─ focus bar ────────────────────┤
│              │                                │
│  SIDEBAR     │  Main content (diff/content)   │
│  (260px)     │                                │
│              │                                │
├─ focus bar ──┤                                │
│              │                                │
├──────────────┴────────────────────────────────┤
│  Status bar                                   │
└───────────────────────────────────────────────┘
```

- **Sidebar** (260px fixed) extends full height from top to status bar, with `bg-card` (#181825 mantle) for visual separation from main content (`bg-background` #1e1e2e)
- **Toolbar** sits at the top of the right column, 52px tall with `border-b`
- **Drag regions** use `--wails-draggable: drag` CSS property (classes `.drag-region` / `.no-drag`). The sidebar header and toolbar are both drag regions for window movement

## Branding / Logotype

- The logotype is `o_(◉) monocle` rendered in **JetBrains Mono weight 600** — matching the website's `.nav-logo`
- Color: `text-ctp-blue` (#89b4fa) with the eye `◉` in `text-ctp-lavender` (#b4befe)
- Appears in: sidebar header (next to traffic lights), project picker, and main pane empty state
- Always lowercase "monocle"
- Import: `@fontsource/jetbrains-mono/600.css`

## Focus Indication

Two-pane keyboard-first app — exactly one pane (sidebar or main) is focused at any time.

- **Focus indicator bars**: 2px horizontal bars sit between the drag region/toolbar and each pane's content. The focused pane's bar is `bg-primary` with `shadow-[0_0_8px_var(--color-primary)]` (blue glow). The unfocused bar is `bg-ctp-surface0/30` (barely visible)
- **Sidebar selections**: Focused cursor gets full `bg-accent`. Unfocused selected item dims to `bg-accent/40`
- **Diff view cursor**: Focused shows outline `1px solid #89b4fa40` with `--diff-code-selected-background-color: #45475a`. Unfocused dims to `#89b4fa1a` outline and `#45475a66` background (~40% opacity, matching sidebar)
- **No border-based focus** — the old TUI-style colored borders were removed in favor of the accent bars

## Sidebar

- **Rounded selections** (`rounded-md`) with `mx-2` horizontal margin — Finder-style pill selections
- **Section headers**: `text-[10px] font-semibold uppercase tracking-wider` with `px-4`
- **Traffic light clearance**: 78px left padding in the header area for the logotype, positioned to the right of the traffic lights
- **File icons**: Nerd Font devicons via `@azurity/pure-nerd-font`

## Toolbar

- **Project switcher dropdown**: Clicking the project name (with folder icon + chevron) opens a dropdown of recent projects with an "Open Folder..." option at the bottom
- **Connection indicator**: Small dot on the right — green with glow when agent connected, muted `bg-ctp-surface2` when not
- Height matches the sidebar header (52px) for alignment

## Modals / Dialogs

- **Width**: `sm:max-w-2xl` (672px) for both comment editor and submit dialog
- **Keyboard hints**: Platform-aware — show `⌘` on macOS, `Ctrl+` elsewhere. Uses `navigator.platform` detection
- **Separator spacing**: Use `mx-2` on middot separators between hint items

## Empty State (Splash Screen)

Matches the TUI splash (`internal/tui/splash.go`):
- Logotype at `text-xl`
- Tagline: "code review companion for your AI agent"
- Getting started: `monocle register` command
- Manual install: Claude Code (`/plugin marketplace add ...`) and Gemini CLI commands
- Review section: keybinding hints for c/C/S
- Feedback section: explains the feedback queue and `/get-feedback` skill
- All in monospace (`font-mono text-[13px]`), commands in `text-ctp-yellow`, sections in `text-ctp-sky`

## Color Conventions

- **Commands/keys**: `text-ctp-yellow` (#f9e2af)
- **Section headers**: `text-ctp-sky` (#89dceb)
- **Body text**: `text-muted-foreground` (#6c7086)
- **Primary/focus**: `text-ctp-blue` / `bg-primary` (#89b4fa)
- **Connected**: `text-ctp-green` / `bg-ctp-green` (#a6e3a1)
- **File status**: added=green, modified=yellow, deleted=red, renamed=mauve

## Platform Considerations

- **macOS**: Traffic light repositioning via CGO, `⌘` in keyboard hints, `NSAppearanceNameDarkAqua`
- **Non-macOS**: `traffic_lights_other.go` is a no-op stub, keyboard hints show `Ctrl+`
- **Font stack**: JetBrains Mono for logotype, Plus Jakarta Sans for UI text, system monospace for code
