# Monocle Desktop App

Native desktop app version of Monocle using [Wails v2](https://wails.io/) — Go backend + React frontend in a native WebView.

**Read [DESIGN.md](DESIGN.md) before making UI changes.** It documents all visual and interaction design decisions — window chrome, focus system, branding, color conventions, and platform considerations.

## How It Relates to the TUI

The TUI (`internal/tui/`) and the desktop app are two independent frontends for the same engine. They share 100% of the backend:

- **EngineAPI** (`internal/core/engine.go`) — the contract both UIs use
- **Database, types, git, sessions, feedback** — all unchanged
- **Socket server** — agents still connect via Unix socket, same as with TUI

The desktop app adds zero backend logic. It is purely a new rendering layer.

## Architecture

```
┌────────────────────────────────────────┐
│  Wails Desktop Window (native WebView) │
│  ┌──────────────────────────────────┐  │
│  │  React + shadcn/ui + Shiki      │  │
│  │  desktop/frontend/src/           │  │
│  └──────────┬───────────────────────┘  │
│             │ Wails IPC (auto-bindings)│
│  ┌──────────▼───────────────────────┐  │
│  │  Go: desktop/*.go                │  │
│  │  ├─ bindings.go (App struct)     │  │
│  │  ├─ events.go (engine→Wails)     │  │
│  │  └─ run.go (wails.Run)          │  │
│  └──────────┬───────────────────────┘  │
│             │ calls EngineAPI          │
│  ┌──────────▼───────────────────────┐  │
│  │  internal/core/ (shared engine)  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
         ↕ Unix socket (unchanged)
    Agent (Claude Code via native app)
```

Entry point: `main.go` at the project root (separate from `cmd/monocle/main.go` which is the TUI/CLI).

## Go Files (desktop/)

- **`bindings.go`** — `App` struct whose public methods become callable from JavaScript via Wails auto-bindings. Wraps `EngineAPI` methods with nil-guard checks (engine is nil until a project is selected). Also has `SelectProject()`, `GetRecentProjects()`, and `OpenDirectoryDialog()` for the project picker.
- **`events.go`** — `bridgeEngineEvents()` subscribes to all `core.Event*` types and forwards them via `wailsRuntime.EventsEmit()`. Mirrors the TUI's `BridgeEngineEvents` in `internal/tui/app.go`.
- **`run.go`** — `Run()` calls `wails.Run()` with app options. Embeds `frontend/dist` via `//go:embed`.

## Frontend (desktop/frontend/)

React + TypeScript + Vite + Tailwind CSS + shadcn/ui.

### Key files

- **`src/App.tsx`** — Root component. Shows `ProjectPicker` until a project is selected, then `ReviewUI`. All app state lives here (session, files, diff, focus, dialogs).
- **`src/types.ts`** — TypeScript interfaces matching Go domain types. Hand-maintained (Wails v2 doesn't auto-generate TS types).
- **`src/api.ts`** — Typed wrapper around `window.go.desktop.App.*` Wails bindings + event subscription helper.
- **`src/components/DiffView.tsx`** — Diff rendering via `react-diff-view` + syntax highlighting via Shiki (catppuccin-mocha theme). Uses `tokenize(hunks, { highlight: false })` for structural tokens, then `renderToken` applies Shiki inline styles.
- **`src/components/Sidebar.tsx`** — File tree with flat/tree modes, review filter, status icons. Exposes items via `onItemsChange` so keyboard nav in App can resolve cursor → item.
- **`src/components/ProjectPicker.tsx`** — Startup screen: recent projects from DB + native OS directory picker.
- **`src/hooks/useKeyboard.ts`** — Focus-aware keyboard shortcut system.

### Component library

Uses [shadcn/ui](https://ui.shadcn.com/) (source-owned components in `src/components/ui/`). Add new components with `bunx shadcn@latest add <name>`.

### Theme

Catppuccin Mocha, always dark. Colors mapped from the TUI's ANSI palette in `src/index.css`. Diff view colors use react-diff-view CSS custom properties overridden in the same file. Syntax highlighting colors come from Shiki's built-in catppuccin-mocha theme (inline styles, not CSS classes).

## Build & Dev

```bash
devbox run -- make build-desktop   # Production .app bundle → build/bin/monocle.app
devbox run -- make dev-desktop     # Dev mode: Vite HMR + Go rebuild
```

Wails is managed via devbox (not globally installed). The `wails.json` at the project root configures the frontend directory and build commands.

## Keyboard-First Design

All TUI keybindings are replicated. Keyboard shortcuts are wired in `useKeyboard` hooks in App.tsx, not deferred to a polish phase. The sidebar, diff view, and dialogs are all fully keyboard-navigable. See `src/components/HelpDialog.tsx` for the full keybinding reference.

## Adding Features

When adding a new feature that touches the UI:

1. **Engine change** — implement once in `internal/core/`. Both UIs benefit.
2. **Go binding** — add a method to `App` in `bindings.go`. Keep it a thin wrapper around `EngineAPI`.
3. **TypeScript type** — update `types.ts` if new types are involved.
4. **API wrapper** — add to `api.ts` (both the `Window` type declaration and the `api` object).
5. **React component** — build the UI. Use shadcn/ui components where possible.
6. **Keyboard shortcut** — add to the `useKeyboard` call in App.tsx.

The TUI equivalent lives in `internal/tui/`. Features don't need to ship in both UIs simultaneously.
