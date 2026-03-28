# Monocle

Terminal-based code review companion for AI coding agents. Run Monocle alongside your agent — the agent writes code, you review diffs and leave structured feedback, and Monocle delivers your review back via MCP.

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
| `submit_for_review` | Submit content (plans, summaries, decisions, etc.) for the reviewer to see and comment on |
| `submit_for_review_and_wait` | Submit content and block until the reviewer responds — use for review gating |
| `add_files` | Add additional files for the reviewer to see in Monocle |

## How it works

Monocle runs a TUI that watches your repo for changes. When Claude modifies files, Monocle shows you the diffs. You review, add inline comments, and submit. The plugin registers Monocle's built-in MCP channel server, which connects to the engine via a Unix domain socket and pushes your feedback to Claude as channel notifications.

Claude can also submit content (plans, summaries, decisions) for your review — these appear in Monocle's TUI so you can provide early feedback.

## Pause flow

Press **P** in Monocle to request Claude pause. Claude receives a notification and blocks until you submit your review — giving you time to catch up without the agent racing ahead.

## Plan mode

When your agent is in plan mode, Monocle can gate implementation behind reviewer approval. Instead of `submit_for_review`, the agent uses `submit_for_review_and_wait` — which submits the content and blocks until you review it.

For this to work reliably, add the following to your project's `CLAUDE.md`:

````markdown
## Monocle Integration

When the Monocle MCP channel is connected:
- Use the `submit_for_review` MCP tool to send content for the reviewer to see
- Use the plan filename as the `id` parameter so updates replace the previous version

**Plan mode (important):** When in plan mode, use `submit_for_review_and_wait` instead of `submit_for_review`. This tool submits the content AND blocks until the reviewer responds with feedback. If they request changes, update and call `submit_for_review_and_wait` again to start another review round. Keep iterating until the reviewer approves, then continue with your normal workflow.
````

See the [main README](https://github.com/josephschmitt/monocle#plan-mode-integration) for the full plan mode workflow.
