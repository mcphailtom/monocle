// Nerd Font devicons for file types — mirrors internal/tui/devicons.go

interface IconInfo {
  glyph: string;
  color: string;
}

const defaultIcon: IconInfo = { glyph: "\uf15b", color: "#6c7086" };

const nameIcons: Record<string, IconInfo> = {
  "makefile":           { glyph: "\ue779", color: "#6d8086" },
  "dockerfile":         { glyph: "\ue7b0", color: "#384d54" },
  "docker-compose.yml": { glyph: "\ue7b0", color: "#384d54" },
  ".gitignore":         { glyph: "\ue702", color: "#f54d27" },
  ".gitconfig":         { glyph: "\ue702", color: "#f54d27" },
  ".gitmodules":        { glyph: "\ue702", color: "#f54d27" },
  "go.mod":             { glyph: "\ue627", color: "#00acd7" },
  "go.sum":             { glyph: "\ue627", color: "#00acd7" },
  "package.json":       { glyph: "\ue71e", color: "#e8274b" },
  "tsconfig.json":      { glyph: "\ue628", color: "#519aba" },
  "license":            { glyph: "\uf718", color: "#d0bf41" },
  "readme.md":          { glyph: "\uf48a", color: "#519aba" },
  "changelog.md":       { glyph: "\uf48a", color: "#519aba" },
  ".env":               { glyph: "\uf462", color: "#faf743" },
  ".env.local":         { glyph: "\uf462", color: "#faf743" },
  "devbox.json":        { glyph: "\uf489", color: "#a074c4" },
  "devbox.lock":        { glyph: "\uf489", color: "#a074c4" },
};

const extIcons: Record<string, IconInfo> = {
  // Go
  ".go": { glyph: "\ue627", color: "#00acd7" },

  // Web
  ".js":   { glyph: "\ue74e", color: "#cbcb41" },
  ".mjs":  { glyph: "\ue74e", color: "#cbcb41" },
  ".jsx":  { glyph: "\ue7ba", color: "#20c2e3" },
  ".ts":   { glyph: "\ue628", color: "#519aba" },
  ".tsx":  { glyph: "\ue7ba", color: "#519aba" },
  ".html": { glyph: "\ue736", color: "#e44d26" },
  ".css":  { glyph: "\ue749", color: "#42a5f5" },
  ".scss": { glyph: "\ue749", color: "#f55385" },
  ".vue":  { glyph: "\ue6a0", color: "#8dc149" },

  // Data
  ".json": { glyph: "\ue60b", color: "#cbcb41" },
  ".yaml": { glyph: "\ue60b", color: "#6d8086" },
  ".yml":  { glyph: "\ue60b", color: "#6d8086" },
  ".toml": { glyph: "\ue60b", color: "#6d8086" },
  ".xml":  { glyph: "\ue619", color: "#e44d26" },
  ".csv":  { glyph: "\uf1c3", color: "#89e051" },

  // Scripting
  ".py":   { glyph: "\ue73c", color: "#ffbc03" },
  ".rb":   { glyph: "\ue791", color: "#e52002" },
  ".sh":   { glyph: "\ue795", color: "#4eaa25" },
  ".bash": { glyph: "\ue795", color: "#4eaa25" },
  ".zsh":  { glyph: "\ue795", color: "#4eaa25" },
  ".fish": { glyph: "\ue795", color: "#4eaa25" },
  ".lua":  { glyph: "\ue620", color: "#51a0cf" },

  // Systems
  ".rs":    { glyph: "\ue7a8", color: "#dea584" },
  ".c":     { glyph: "\ue61e", color: "#599eff" },
  ".h":     { glyph: "\ue61e", color: "#a074c4" },
  ".cpp":   { glyph: "\ue61d", color: "#f34b7d" },
  ".hpp":   { glyph: "\ue61d", color: "#a074c4" },
  ".java":  { glyph: "\ue738", color: "#cc3e44" },
  ".kt":    { glyph: "\ue634", color: "#7f52ff" },
  ".swift": { glyph: "\ue755", color: "#e37933" },

  // Config
  ".sql":     { glyph: "\ue706", color: "#dad8d8" },
  ".db":      { glyph: "\ue706", color: "#dad8d8" },
  ".graphql": { glyph: "\ue662", color: "#e535ab" },

  // Docs
  ".md":  { glyph: "\ue73e", color: "#519aba" },
  ".txt": { glyph: "\uf15c", color: "#89e051" },
  ".pdf": { glyph: "\uf1c1", color: "#b30b00" },

  // Images
  ".png":  { glyph: "\uf1c5", color: "#a074c4" },
  ".jpg":  { glyph: "\uf1c5", color: "#a074c4" },
  ".jpeg": { glyph: "\uf1c5", color: "#a074c4" },
  ".gif":  { glyph: "\uf1c5", color: "#a074c4" },
  ".svg":  { glyph: "\uf1c5", color: "#ffb13b" },
  ".ico":  { glyph: "\uf1c5", color: "#cbcb41" },

  // Archives
  ".zip": { glyph: "\uf1c6", color: "#eca517" },
  ".tar": { glyph: "\uf1c6", color: "#eca517" },
  ".gz":  { glyph: "\uf1c6", color: "#eca517" },

  // Lock files
  ".lock": { glyph: "\uf023", color: "#6d8086" },
};

export function fileIcon(path: string): IconInfo {
  const base = path.split("/").pop()?.toLowerCase() ?? "";

  if (nameIcons[base]) return nameIcons[base];

  const dotIdx = base.lastIndexOf(".");
  if (dotIdx >= 0) {
    const ext = base.slice(dotIdx).toLowerCase();
    if (extIcons[ext]) return extIcons[ext];
  }

  return defaultIcon;
}
