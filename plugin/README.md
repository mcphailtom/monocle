# Monocle

Terminal-based code review companion for Claude Code. Run Monocle alongside Claude Code — the agent writes code, you review diffs and leave structured feedback, and Monocle delivers your review back to Claude via an MCP channel.

## Prerequisites

- [Monocle](https://github.com/josephschmitt/monocle) — install via Homebrew:
  ```
  brew install josephschmitt/tap/monocle
  ```

## Setup

1. Add the marketplace:
   ```
   /plugin marketplace add josephschmitt/monocle
   ```

2. Install the plugin:
   ```
   /plugin install monocle@monocle
   ```

3. Start Claude Code with the channel enabled:
   ```
   claude --channels plugin:monocle@monocle
   ```

4. In a separate terminal, start Monocle in the same repo:
   ```
   monocle
   ```

Monocle's TUI will display diffs as Claude makes changes. Add comments, then submit your review — Claude receives the feedback automatically.

## Tools

| Tool | Description |
|------|-------------|
| `review_status` | Check if the reviewer has pending feedback or has requested a pause |
| `get_feedback` | Retrieve review feedback. Use `wait=true` to block until feedback is available |
| `submit_plan` | Submit a plan or architecture decision for the reviewer to see and comment on |

## How it works

Monocle runs a TUI that watches your repo for changes. When Claude modifies files, Monocle shows you the diffs. You review, add inline comments, and submit. The plugin registers Monocle's built-in MCP channel server, which connects to the engine via a Unix domain socket and pushes your feedback to Claude as channel notifications.

Claude can also submit plans for your review before writing code — these appear in Monocle's TUI so you can provide early feedback.

## Pause flow

Press **P** in Monocle to request Claude pause. Claude receives a notification and blocks until you submit your review — giving you time to catch up without the agent racing ahead.
