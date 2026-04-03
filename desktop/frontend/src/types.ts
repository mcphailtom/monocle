// Domain types matching Go structs from internal/types/ and desktop/bindings.go.
// Field names are PascalCase to match Go's default JSON encoding (no json tags).

// --- Enums ---

export type FileChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "none";

export type CommentType = "issue" | "suggestion" | "note" | "praise";

export type TargetType = "file" | "content" | "additional_file";

export type SubmitAction = "request_changes" | "approve";

export type DiffLineKind = "context" | "added" | "removed";

// --- Domain types ---

export interface ReviewSession {
  ID: string;
  Agent: string;
  RepoRoot: string;
  BaseRef: string;
  ChangedFiles: ChangedFile[];
  ContentItems: ContentItem[];
  AdditionalFiles: AdditionalFile[];
  Comments: ReviewComment[];
  FileStatuses: Record<string, boolean>;
  IgnorePatterns: string[];
  ReviewRound: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ChangedFile {
  Path: string;
  Status: FileChangeStatus;
  Reviewed: boolean;
}

export interface AdditionalFile {
  Path: string;
  Name: string;
  Reviewed: boolean;
}

export interface ContentItem {
  ID: string;
  Title: string;
  Content: string;
  PreviousContent: string;
  ContentType: string;
  IsPlan: boolean;
  Reviewed: boolean;
  Comments: ReviewComment[];
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ReviewComment {
  ID: string;
  TargetType: TargetType;
  TargetRef: string;
  LineStart: number;
  LineEnd: number;
  Type: CommentType;
  Body: string;
  CodeSnippet: string;
  Resolved: boolean;
  ReviewRound: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ReviewSubmission {
  ID: string;
  SessionID: string;
  Action: SubmitAction;
  FormattedReview: string;
  CommentCount: number;
  ReviewRound: number;
  SubmittedAt: string;
  DeliveredAt: string | null;
}

export interface DiffLine {
  Kind: DiffLineKind;
  OldLineNum: number;
  NewLineNum: number;
  Content: string;
}

export interface DiffHunk {
  OldStart: number;
  OldCount: number;
  NewStart: number;
  NewCount: number;
  Header: string;
  Lines: DiffLine[];
}

export interface DiffResult {
  Path: string;
  Hunks: DiffHunk[];
}

export interface ReviewSummary {
  Session: ReviewSession | null;
  FileComments: Record<string, ReviewComment[]>;
  ContentComments: Record<string, ReviewComment[]>;
  AdditionalFileComments: Record<string, ReviewComment[]>;
  IssueCt: number;
  SuggestionCt: number;
  NoteCt: number;
  PraiseCt: number;
}

export interface SessionSummary {
  ID: string;
  Agent: string;
  RepoRoot: string;
  FileCount: number;
  CommentCount: number;
  ReviewRound: number;
  CreatedAt: string;
  UpdatedAt: string;
}

// --- Config types (uses json tags: snake_case) ---

export interface ReviewFormatConfig {
  include_snippets: boolean;
  max_snippet_lines: number;
  include_summary: boolean;
}

export interface Config {
  ignore_patterns: string[];
  keybindings: Record<string, string>;
  diff_style: string;
  sidebar_style: string;
  layout: string;
  wrap: boolean;
  tab_size: number;
  context_lines: number;
  review_format: ReviewFormatConfig;
  auto_focus_mode: boolean;
  mouse: boolean | null;
  min_diff_width: number;
}

// --- Desktop-only types (from desktop/bindings.go, has json tags) ---

export interface LogEntry {
  hash: string;
  subject: string;
}

export interface SubmitResult {
  AgentConnected: boolean;
}

// --- Project picker ---

export interface RecentProject {
  path: string;
  name: string;
  session_count: number;
  last_opened: string;
}

// --- Event payloads ---

export interface FileChangedEvent {
  path: string;
}

export interface FeedbackStatusChangedEvent {
  status: string;
}

export interface ContentItemAddedEvent {
  id: string;
}

export interface AdditionalFileAddedEvent {
  path: string;
}

export interface PauseChangedEvent {
  status: string;
}

export interface ConnectionChangedEvent {
  status: string;
  message: string;
}

export interface WaitStatusChangedEvent {
  status: string;
}
