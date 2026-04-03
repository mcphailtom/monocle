package desktop

import (
	"context"

	"github.com/josephschmitt/monocle/internal/core"
	"github.com/josephschmitt/monocle/internal/types"
)

// App exposes EngineAPI methods to the Wails frontend via auto-generated bindings.
type App struct {
	ctx    context.Context
	engine core.EngineAPI
}

// NewApp creates a new Wails app binding layer.
func NewApp(engine core.EngineAPI) *App {
	return &App{engine: engine}
}

// startup is called by Wails when the application starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	bridgeEngineEvents(a.engine, ctx)
}

// --- Session lifecycle ---

func (a *App) GetSession() *types.ReviewSession {
	return a.engine.GetSession()
}

func (a *App) ListSessions(repoRoot string, limit int) ([]types.SessionSummary, error) {
	return a.engine.ListSessions(core.ListSessionsOptions{
		RepoRoot: repoRoot,
		Limit:    limit,
	})
}

// --- Browsing ---

func (a *App) RefreshChangedFiles() ([]types.ChangedFile, error) {
	return a.engine.RefreshChangedFiles()
}

func (a *App) GetChangedFiles() []types.ChangedFile {
	return a.engine.GetChangedFiles()
}

func (a *App) GetContentItems() []types.ContentItem {
	return a.engine.GetContentItems()
}

func (a *App) GetFileDiff(path string) (*types.DiffResult, error) {
	return a.engine.GetFileDiff(path)
}

func (a *App) GetFileContent(path string) (string, error) {
	return a.engine.GetFileContent(path)
}

func (a *App) GetContentItem(id string) (*types.ContentItem, error) {
	return a.engine.GetContentItem(id)
}

func (a *App) GetContentDiff(id string) (*types.DiffResult, error) {
	return a.engine.GetContentDiff(id)
}

// --- Additional files ---

func (a *App) GetAdditionalFiles() []types.AdditionalFile {
	return a.engine.GetAdditionalFiles()
}

func (a *App) GetAdditionalFileContent(absPath string) (string, error) {
	return a.engine.GetAdditionalFileContent(absPath)
}

// --- Commenting ---

func (a *App) AddComment(targetType string, targetRef string, lineStart int, lineEnd int, commentType string, body string) (*types.ReviewComment, error) {
	return a.engine.AddComment(
		core.CommentTarget{
			TargetType: types.TargetType(targetType),
			TargetRef:  targetRef,
			LineStart:  lineStart,
			LineEnd:    lineEnd,
		},
		types.CommentType(commentType),
		body,
	)
}

func (a *App) EditComment(commentID string, commentType string, body string) (*types.ReviewComment, error) {
	return a.engine.EditComment(commentID, types.CommentType(commentType), body)
}

func (a *App) DeleteComment(commentID string) error {
	return a.engine.DeleteComment(commentID)
}

func (a *App) ResolveComment(commentID string) error {
	return a.engine.ResolveComment(commentID)
}

func (a *App) ClearComments() error {
	return a.engine.ClearComments()
}

func (a *App) ClearReview() error {
	return a.engine.ClearReview()
}

// --- Review status ---

func (a *App) MarkReviewed(path string) error {
	return a.engine.MarkReviewed(path)
}

func (a *App) UnmarkReviewed(path string) error {
	return a.engine.UnmarkReviewed(path)
}

func (a *App) MarkContentReviewed(id string) error {
	return a.engine.MarkContentReviewed(id)
}

func (a *App) UnmarkContentReviewed(id string) error {
	return a.engine.UnmarkContentReviewed(id)
}

func (a *App) ResetAllReviewed() error {
	return a.engine.ResetAllReviewed()
}

func (a *App) MarkAllReviewed() error {
	return a.engine.MarkAllReviewed()
}

// --- Submission ---

func (a *App) GetReviewSummary() (*types.ReviewSummary, error) {
	return a.engine.GetReviewSummary()
}

func (a *App) Submit(action string, body string) (*core.SubmitResult, error) {
	return a.engine.Submit(types.SubmitAction(action), body)
}

func (a *App) FormatReview(action string, body string) (string, error) {
	return a.engine.FormatReview(types.SubmitAction(action), body)
}

func (a *App) GetSubmissions() ([]types.ReviewSubmission, error) {
	return a.engine.GetSubmissions()
}

// --- Base ref ---

func (a *App) SetBaseRef(ref string) error {
	return a.engine.SetBaseRef(ref)
}

func (a *App) SetAutoAdvanceRef(enabled bool) {
	a.engine.SetAutoAdvanceRef(enabled)
}

func (a *App) IsAutoAdvanceRef() bool {
	return a.engine.IsAutoAdvanceRef()
}

func (a *App) SelectedBaseRef() string {
	return a.engine.SelectedBaseRef()
}

// LogEntry wraps core.LogEntry for Wails binding generation.
type LogEntry struct {
	Hash    string `json:"hash"`
	Subject string `json:"subject"`
}

func (a *App) RecentCommits(n int) ([]LogEntry, error) {
	commits, err := a.engine.RecentCommits(n)
	if err != nil {
		return nil, err
	}
	result := make([]LogEntry, len(commits))
	for i, c := range commits {
		result[i] = LogEntry{Hash: c.Hash, Subject: c.Subject}
	}
	return result, nil
}

// --- Feedback ---

func (a *App) GetFeedbackStatus() string {
	return a.engine.GetFeedbackStatus()
}

func (a *App) GetQueuedCount() int {
	return a.engine.GetQueuedCount()
}

func (a *App) RequestPause() {
	a.engine.RequestPause()
}

func (a *App) CancelPause() {
	a.engine.CancelPause()
}

// --- Connection ---

func (a *App) GetSubscriberCount() int {
	return a.engine.GetSubscriberCount()
}

func (a *App) GetSocketPath() string {
	return a.engine.GetSocketPath()
}

// --- Config ---

func (a *App) GetConfig() *types.Config {
	return a.engine.GetConfig()
}
