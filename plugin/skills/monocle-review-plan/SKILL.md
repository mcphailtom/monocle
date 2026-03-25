---
name: monocle-review-plan
description: Send a plan to Monocle for review (fire-and-forget). Use when the user wants to share a plan with their reviewer without blocking.
argument-hint: [plan-file-path]
allowed-tools: [Read, Glob, mcp__plugin_monocle_monocle__submit_plan]
---

# Send Plan to Monocle

Submit a plan file to Monocle so the reviewer can see it. This does NOT wait for feedback — use `/monocle-review-plan-wait` if you need to block until the reviewer responds.

## Instructions

1. **Find the plan file:**
   - If the user provided a path via `$ARGUMENTS`, use that
   - Otherwise, look for the active plan file in `.claude/plans/` (most recently modified `.md` file)

2. **Read the plan file** to confirm it exists and get its filename

3. **Call the `submit_plan` MCP tool** with:
   - `title`: The first markdown heading from the plan, or the filename if no heading found
   - `file_path`: Absolute path to the plan file
   - `id`: The plan filename (e.g. `my-plan.md`) — this ensures updates replace the previous version
   - `content_type`: `"md"`

4. **Confirm** to the user that the plan was sent to Monocle
