// Typed wrapper around Wails Go bindings (window.go.desktop.App.*).
// Also provides an events helper for engine events (window.runtime.EventsOn).

import type {
  ReviewSession,
  SessionSummary,
  ChangedFile,
  ContentItem,
  AdditionalFile,
  DiffResult,
  ReviewComment,
  ReviewSummary,
  ReviewSubmission,
  LogEntry,
  SubmitResult,
  Config,
  RecentProject,
  ReviewSnapshot,
  ContentVersion,
  TargetType,
  CommentType,
  FileChangedEvent,
  FeedbackStatusChangedEvent,
  ContentItemAddedEvent,
  AdditionalFileAddedEvent,
  PauseChangedEvent,
  ConnectionChangedEvent,
  WaitStatusChangedEvent,
} from "./types";

// Augment the global Window with Wails runtime types.
declare global {
  interface Window {
    go: {
      desktop: {
        App: {
          // Project selection
          GetRecentProjects(): Promise<RecentProject[]>;
          OpenDirectoryDialog(): Promise<string>;
          OpenAdditionalFilesDialog(): Promise<string[] | null>;
          SelectProject(projectPath: string): Promise<string>;

          // Session
          StartSessionForProject(agent: string): Promise<ReviewSession | null>;
          ResumeSession(sessionID: string): Promise<ReviewSession | null>;
          GetSession(): Promise<ReviewSession | null>;
          ListSessions(repoRoot: string, limit: number): Promise<SessionSummary[]>;

          // Browsing
          RefreshChangedFiles(): Promise<ChangedFile[]>;
          GetChangedFiles(): Promise<ChangedFile[]>;
          GetContentItems(): Promise<ContentItem[]>;
          GetFileDiff(path: string): Promise<DiffResult | null>;
          GetFileContent(path: string): Promise<string>;
          GetContentItem(id: string): Promise<ContentItem | null>;
          GetContentDiff(id: string): Promise<DiffResult | null>;
          GetContentVersions(id: string): Promise<ContentVersion[] | null>;
          GetContentDiffBetweenVersions(
            id: string,
            fromVersion: number,
            toVersion: number,
          ): Promise<DiffResult | null>;

          // Additional files
          GetAdditionalFiles(): Promise<AdditionalFile[]>;
          GetAdditionalFileContent(absPath: string): Promise<string>;
          AddAdditionalPaths(paths: string[]): Promise<AdditionalFile[] | null>;

          // Comments
          AddComment(
            targetType: TargetType,
            targetRef: string,
            lineStart: number,
            lineEnd: number,
            commentType: CommentType,
            body: string,
          ): Promise<ReviewComment>;
          EditComment(
            commentID: string,
            commentType: CommentType,
            body: string,
          ): Promise<ReviewComment>;
          DeleteComment(commentID: string): Promise<void>;
          ResolveComment(commentID: string): Promise<void>;
          ClearComments(): Promise<void>;
          ClearReview(): Promise<void>;

          // Review status
          MarkReviewed(path: string): Promise<void>;
          UnmarkReviewed(path: string): Promise<void>;
          MarkContentReviewed(id: string): Promise<void>;
          UnmarkContentReviewed(id: string): Promise<void>;
          ResetAllReviewed(): Promise<void>;
          MarkAllReviewed(): Promise<void>;

          // Submission
          GetReviewSummary(): Promise<ReviewSummary | null>;
          Submit(action: string, body: string): Promise<SubmitResult>;
          FormatReview(action: string, body: string): Promise<string>;
          GetSubmissions(): Promise<ReviewSubmission[]>;

          // Base ref
          SetBaseRef(ref: string): Promise<void>;
          SetAutoAdvanceRef(enabled: boolean): Promise<void>;
          IsAutoAdvanceRef(): Promise<boolean>;
          SelectedBaseRef(): Promise<string>;
          RecentCommits(n: number): Promise<LogEntry[]>;

          // Snapshots
          GetSnapshots(): Promise<ReviewSnapshot[] | null>;
          SetSnapshotBase(snapshotID: number): Promise<void>;
          ClearSnapshotBase(): Promise<void>;
          GetActiveSnapshot(): Promise<ReviewSnapshot | null>;
          HasSnapshots(): Promise<boolean>;

          // Feedback
          GetFeedbackStatus(): Promise<string>;
          GetQueuedCount(): Promise<number>;
          RequestPause(): Promise<void>;
          CancelPause(): Promise<void>;

          // Connection
          GetSubscriberCount(): Promise<number>;
          GetSocketPath(): Promise<string>;

          // External editor
          OpenExternalEditor(initialText: string): Promise<string>;

          // Mode
          IsNonGitMode(): Promise<boolean>;

          // Claude MCP registration
          ClaudeNeedsRegister(): Promise<boolean>;
          RegisterClaude(global: boolean): Promise<void>;

          // Config
          GetConfig(): Promise<Config | null>;
          SaveConfig(cfg: Config): Promise<void>;
        };
      };
    };
    runtime: {
      EventsOn(
        eventName: string,
        callback: (...args: unknown[]) => void,
      ): () => void;
    };
  }
}

// Shorthand for the Go App binding.
const app = () => window.go.desktop.App;

// --- API ---

export const api = {
  // Project selection
  getRecentProjects: () => app().GetRecentProjects(),
  openDirectoryDialog: () => app().OpenDirectoryDialog(),
  openAdditionalFilesDialog: () => app().OpenAdditionalFilesDialog(),
  selectProject: (path: string) => app().SelectProject(path),

  // Session
  startSessionForProject: (agent: string = "claude") =>
    app().StartSessionForProject(agent),
  resumeSession: (sessionID: string) => app().ResumeSession(sessionID),
  getSession: () => app().GetSession(),
  listSessions: (repoRoot: string, limit: number) =>
    app().ListSessions(repoRoot, limit),

  // Browsing
  refreshChangedFiles: () => app().RefreshChangedFiles(),
  getChangedFiles: () => app().GetChangedFiles(),
  getContentItems: () => app().GetContentItems(),
  getFileDiff: (path: string) => app().GetFileDiff(path),
  getFileContent: (path: string) => app().GetFileContent(path),
  getContentItem: (id: string) => app().GetContentItem(id),
  getContentDiff: (id: string) => app().GetContentDiff(id),
  getContentVersions: (id: string) => app().GetContentVersions(id),
  getContentDiffBetweenVersions: (
    id: string,
    fromVersion: number,
    toVersion: number,
  ) => app().GetContentDiffBetweenVersions(id, fromVersion, toVersion),

  // Additional files
  getAdditionalFiles: () => app().GetAdditionalFiles(),
  addAdditionalPaths: (paths: string[]) => app().AddAdditionalPaths(paths),
  getAdditionalFileContent: (absPath: string) =>
    app().GetAdditionalFileContent(absPath),

  // Comments
  addComment: (
    targetType: TargetType,
    targetRef: string,
    lineStart: number,
    lineEnd: number,
    commentType: CommentType,
    body: string,
  ) => app().AddComment(targetType, targetRef, lineStart, lineEnd, commentType, body),
  editComment: (commentID: string, commentType: CommentType, body: string) =>
    app().EditComment(commentID, commentType, body),
  deleteComment: (commentID: string) => app().DeleteComment(commentID),
  resolveComment: (commentID: string) => app().ResolveComment(commentID),
  clearComments: () => app().ClearComments(),
  clearReview: () => app().ClearReview(),

  // Review status
  markReviewed: (path: string) => app().MarkReviewed(path),
  unmarkReviewed: (path: string) => app().UnmarkReviewed(path),
  markContentReviewed: (id: string) => app().MarkContentReviewed(id),
  unmarkContentReviewed: (id: string) => app().UnmarkContentReviewed(id),
  resetAllReviewed: () => app().ResetAllReviewed(),
  markAllReviewed: () => app().MarkAllReviewed(),

  // Submission
  getReviewSummary: () => app().GetReviewSummary(),
  submit: (action: string, body: string) => app().Submit(action, body),
  formatReview: (action: string, body: string) =>
    app().FormatReview(action, body),
  getSubmissions: () => app().GetSubmissions(),

  // Base ref
  setBaseRef: (ref: string) => app().SetBaseRef(ref),
  setAutoAdvanceRef: (enabled: boolean) => app().SetAutoAdvanceRef(enabled),
  isAutoAdvanceRef: () => app().IsAutoAdvanceRef(),
  selectedBaseRef: () => app().SelectedBaseRef(),
  recentCommits: (n: number) => app().RecentCommits(n),

  // Snapshots
  getSnapshots: () => app().GetSnapshots(),
  setSnapshotBase: (snapshotID: number) => app().SetSnapshotBase(snapshotID),
  clearSnapshotBase: () => app().ClearSnapshotBase(),
  getActiveSnapshot: () => app().GetActiveSnapshot(),
  hasSnapshots: () => app().HasSnapshots(),

  // Feedback
  getFeedbackStatus: () => app().GetFeedbackStatus(),
  getQueuedCount: () => app().GetQueuedCount(),
  requestPause: () => app().RequestPause(),
  cancelPause: () => app().CancelPause(),

  // Connection
  getSubscriberCount: () => app().GetSubscriberCount(),
  getSocketPath: () => app().GetSocketPath(),

  // External editor
  openExternalEditor: (initialText: string) => app().OpenExternalEditor(initialText),

  // Mode
  isNonGitMode: () => app().IsNonGitMode(),

  // Claude MCP registration
  claudeNeedsRegister: () => app().ClaudeNeedsRegister(),
  registerClaude: (global: boolean) => app().RegisterClaude(global),

  // Config
  getConfig: () => app().GetConfig(),
  saveConfig: (cfg: Config) => app().SaveConfig(cfg),
} as const;

// --- Events ---

type EventMap = {
  file_changed: FileChangedEvent;
  feedback_status_changed: FeedbackStatusChangedEvent;
  content_item_added: ContentItemAddedEvent;
  additional_file_added: AdditionalFileAddedEvent;
  pause_changed: PauseChangedEvent;
  connection_changed: ConnectionChangedEvent;
  feedback_picked_up: null;
  wait_status_changed: WaitStatusChangedEvent;
};

/**
 * Subscribe to a Wails engine event. Returns an unsubscribe function.
 */
export function onEvent<K extends keyof EventMap>(
  event: K,
  callback: (data: EventMap[K]) => void,
): () => void {
  return window.runtime.EventsOn(event, (data: unknown) => {
    callback(data as EventMap[K]);
  });
}
