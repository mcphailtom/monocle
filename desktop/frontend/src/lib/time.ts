// humanizeAgo formats an ISO timestamp as a relative human-readable string.
// Matches the TUI's `relativeTime` helper in internal/tui/sessionpicker.go.
export function humanizeAgo(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    if (diff < 60_000) return "just now";
    if (diff < 60 * 60_000) {
      const m = Math.floor(diff / 60_000);
      return m === 1 ? "1m ago" : `${m}m ago`;
    }
    if (diff < 24 * 60 * 60_000) {
      const h = Math.floor(diff / (60 * 60_000));
      return h === 1 ? "1h ago" : `${h}h ago`;
    }
    const d = Math.floor(diff / (24 * 60 * 60_000));
    return d === 1 ? "1d ago" : `${d}d ago`;
  } catch {
    return "";
  }
}
