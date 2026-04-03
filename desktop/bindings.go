package desktop

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/josephschmitt/monocle/internal/adapters"
	"github.com/josephschmitt/monocle/internal/core"
	"github.com/josephschmitt/monocle/internal/db"
	"github.com/josephschmitt/monocle/internal/types"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App exposes EngineAPI methods to the Wails frontend via auto-generated bindings.
// Engine init is deferred until the user picks a project via SelectProject().
type App struct {
	ctx      context.Context
	engine   core.EngineAPI
	database *db.DB
}

// startup is called by Wails when the application starts.
// Only opens the database — engine init waits for SelectProject().
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	database, err := db.Open(db.DBPath())
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening database: %v\n", err)
		return
	}
	a.database = database
}

// shutdown is called by Wails when the application is closing.
func (a *App) shutdown(_ context.Context) {
	if a.engine != nil {
		a.engine.Shutdown()
	}
	if a.database != nil {
		a.database.Close()
	}
}

// --- Project selection (before engine is initialized) ---

// RecentProject represents a project the user has previously reviewed.
type RecentProject struct {
	Path         string `json:"path"`
	Name         string `json:"name"`
	SessionCount int    `json:"session_count"`
	LastOpened   string `json:"last_opened"`
}

// GetRecentProjects returns distinct repo roots from past sessions, most recent first.
func (a *App) GetRecentProjects() ([]RecentProject, error) {
	if a.database == nil {
		return nil, nil
	}

	sessions, err := a.database.ListSessions("", 100)
	if err != nil {
		return nil, err
	}

	// Deduplicate by repo root, keeping the most recent and counting sessions
	seen := map[string]*RecentProject{}
	var order []string
	for _, s := range sessions {
		if p, ok := seen[s.RepoRoot]; ok {
			p.SessionCount++
		} else {
			seen[s.RepoRoot] = &RecentProject{
				Path:         s.RepoRoot,
				Name:         filepath.Base(s.RepoRoot),
				SessionCount: 1,
				LastOpened:   s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
			}
			order = append(order, s.RepoRoot)
		}
	}

	result := make([]RecentProject, 0, len(order))
	for _, path := range order {
		result = append(result, *seen[path])
	}
	return result, nil
}

// OpenDirectoryDialog opens a native OS directory picker and returns the selected path.
func (a *App) OpenDirectoryDialog() (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Project Directory",
	})
}

// SelectProject initializes the engine for the given project directory.
// Call this after the user picks a project from the picker or directory dialog.
func (a *App) SelectProject(projectPath string) error {
	// Shut down existing engine if switching projects
	if a.engine != nil {
		a.engine.Shutdown()
		a.engine = nil
	}

	repoRoot := adapters.FindRepoRoot(projectPath)
	nonGitMode := !adapters.IsGitRepo(repoRoot)

	cfg, err := core.LoadConfig()
	if err != nil {
		cfg = core.DefaultConfig()
	}

	engine, err := core.NewEngine(cfg, a.database, repoRoot, nonGitMode)
	if err != nil {
		return fmt.Errorf("create engine: %w", err)
	}
	a.engine = engine

	// Start a new session
	if _, err := engine.StartSession(core.SessionOptions{
		Agent:    "claude",
		RepoRoot: repoRoot,
	}); err != nil {
		return fmt.Errorf("start session: %w", err)
	}

	// Start socket server for agent communication
	socketPath := adapters.DefaultSocketPath(repoRoot)
	if override := os.Getenv("MONOCLE_SOCKET"); override != "" {
		socketPath = override
	}
	if err := engine.StartServer(socketPath); err != nil {
		return fmt.Errorf("start server: %w", err)
	}

	// Bridge engine events to Wails
	bridgeEngineEvents(engine, a.ctx)

	return nil
}

// --- Session lifecycle ---

func (a *App) GetSession() *types.ReviewSession {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetSession()
}

func (a *App) ListSessions(repoRoot string, limit int) ([]types.SessionSummary, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.ListSessions(core.ListSessionsOptions{
		RepoRoot: repoRoot,
		Limit:    limit,
	})
}

// --- Browsing ---

func (a *App) RefreshChangedFiles() ([]types.ChangedFile, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.RefreshChangedFiles()
}

func (a *App) GetChangedFiles() []types.ChangedFile {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetChangedFiles()
}

func (a *App) GetContentItems() []types.ContentItem {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetContentItems()
}

func (a *App) GetFileDiff(path string) (*types.DiffResult, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.GetFileDiff(path)
}

func (a *App) GetFileContent(path string) (string, error) {
	if a.engine == nil {
		return "", nil
	}
	return a.engine.GetFileContent(path)
}

func (a *App) GetContentItem(id string) (*types.ContentItem, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.GetContentItem(id)
}

func (a *App) GetContentDiff(id string) (*types.DiffResult, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.GetContentDiff(id)
}

// --- Additional files ---

func (a *App) GetAdditionalFiles() []types.AdditionalFile {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetAdditionalFiles()
}

func (a *App) GetAdditionalFileContent(absPath string) (string, error) {
	if a.engine == nil {
		return "", nil
	}
	return a.engine.GetAdditionalFileContent(absPath)
}

// --- Commenting ---

func (a *App) AddComment(targetType string, targetRef string, lineStart int, lineEnd int, commentType string, body string) (*types.ReviewComment, error) {
	if a.engine == nil {
		return nil, fmt.Errorf("engine not initialized")
	}
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
	if a.engine == nil {
		return nil, fmt.Errorf("engine not initialized")
	}
	return a.engine.EditComment(commentID, types.CommentType(commentType), body)
}

func (a *App) DeleteComment(commentID string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.DeleteComment(commentID)
}

func (a *App) ResolveComment(commentID string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.ResolveComment(commentID)
}

func (a *App) ClearComments() error {
	if a.engine == nil {
		return nil
	}
	return a.engine.ClearComments()
}

func (a *App) ClearReview() error {
	if a.engine == nil {
		return nil
	}
	return a.engine.ClearReview()
}

// --- Review status ---

func (a *App) MarkReviewed(path string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.MarkReviewed(path)
}

func (a *App) UnmarkReviewed(path string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.UnmarkReviewed(path)
}

func (a *App) MarkContentReviewed(id string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.MarkContentReviewed(id)
}

func (a *App) UnmarkContentReviewed(id string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.UnmarkContentReviewed(id)
}

func (a *App) ResetAllReviewed() error {
	if a.engine == nil {
		return nil
	}
	return a.engine.ResetAllReviewed()
}

func (a *App) MarkAllReviewed() error {
	if a.engine == nil {
		return nil
	}
	return a.engine.MarkAllReviewed()
}

// --- Submission ---

func (a *App) GetReviewSummary() (*types.ReviewSummary, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.GetReviewSummary()
}

func (a *App) Submit(action string, body string) (*core.SubmitResult, error) {
	if a.engine == nil {
		return nil, fmt.Errorf("engine not initialized")
	}
	return a.engine.Submit(types.SubmitAction(action), body)
}

func (a *App) FormatReview(action string, body string) (string, error) {
	if a.engine == nil {
		return "", nil
	}
	return a.engine.FormatReview(types.SubmitAction(action), body)
}

func (a *App) GetSubmissions() ([]types.ReviewSubmission, error) {
	if a.engine == nil {
		return nil, nil
	}
	return a.engine.GetSubmissions()
}

// --- Base ref ---

func (a *App) SetBaseRef(ref string) error {
	if a.engine == nil {
		return nil
	}
	return a.engine.SetBaseRef(ref)
}

func (a *App) SetAutoAdvanceRef(enabled bool) {
	if a.engine == nil {
		return
	}
	a.engine.SetAutoAdvanceRef(enabled)
}

func (a *App) IsAutoAdvanceRef() bool {
	if a.engine == nil {
		return false
	}
	return a.engine.IsAutoAdvanceRef()
}

func (a *App) SelectedBaseRef() string {
	if a.engine == nil {
		return ""
	}
	return a.engine.SelectedBaseRef()
}

// LogEntry wraps core.LogEntry for Wails binding generation.
type LogEntry struct {
	Hash    string `json:"hash"`
	Subject string `json:"subject"`
}

func (a *App) RecentCommits(n int) ([]LogEntry, error) {
	if a.engine == nil {
		return nil, nil
	}
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
	if a.engine == nil {
		return ""
	}
	return a.engine.GetFeedbackStatus()
}

func (a *App) GetQueuedCount() int {
	if a.engine == nil {
		return 0
	}
	return a.engine.GetQueuedCount()
}

func (a *App) RequestPause() {
	if a.engine == nil {
		return
	}
	a.engine.RequestPause()
}

func (a *App) CancelPause() {
	if a.engine == nil {
		return
	}
	a.engine.CancelPause()
}

// --- Connection ---

func (a *App) GetSubscriberCount() int {
	if a.engine == nil {
		return 0
	}
	return a.engine.GetSubscriberCount()
}

func (a *App) GetSocketPath() string {
	if a.engine == nil {
		return ""
	}
	return a.engine.GetSocketPath()
}

// --- Config ---

func (a *App) GetConfig() *types.Config {
	if a.engine == nil {
		return nil
	}
	return a.engine.GetConfig()
}
