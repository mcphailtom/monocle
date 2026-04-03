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
          SelectProject(projectPath: string): Promise<void>;

          // Session
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

          // Additional files
          GetAdditionalFiles(): Promise<AdditionalFile[]>;
          GetAdditionalFileContent(absPath: string): Promise<string>;

          // Comments
          AddComment(
            targetType: string,
            targetRef: string,
            lineStart: number,
            lineEnd: number,
            commentType: string,
            body: string,
          ): Promise<ReviewComment>;
          EditComment(
            commentID: string,
            commentType: string,
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

          // Feedback
          GetFeedbackStatus(): Promise<string>;
          GetQueuedCount(): Promise<number>;
          RequestPause(): Promise<void>;
          CancelPause(): Promise<void>;

          // Connection
          GetSubscriberCount(): Promise<number>;
          GetSocketPath(): Promise<string>;

          // Config
          GetConfig(): Promise<Config | null>;
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
  selectProject: (path: string) => app().SelectProject(path),

  // Session
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

  // Additional files
  getAdditionalFiles: () => app().GetAdditionalFiles(),
  getAdditionalFileContent: (absPath: string) =>
    app().GetAdditionalFileContent(absPath),

  // Comments
  addComment: (
    targetType: string,
    targetRef: string,
    lineStart: number,
    lineEnd: number,
    commentType: string,
    body: string,
  ) => app().AddComment(targetType, targetRef, lineStart, lineEnd, commentType, body),
  editComment: (commentID: string, commentType: string, body: string) =>
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

  // Feedback
  getFeedbackStatus: () => app().GetFeedbackStatus(),
  getQueuedCount: () => app().GetQueuedCount(),
  requestPause: () => app().RequestPause(),
  cancelPause: () => app().CancelPause(),

  // Connection
  getSubscriberCount: () => app().GetSubscriberCount(),
  getSocketPath: () => app().GetSocketPath(),

  // Config
  getConfig: () => app().GetConfig(),
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
