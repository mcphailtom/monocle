package tui

import (
	"fmt"
	"testing"

	"github.com/anthropics/monocle/internal/core"
	"github.com/anthropics/monocle/internal/types"
)

// stubEngine is a minimal EngineAPI stub for testing TUI behavior.
type stubEngine struct {
	core.EngineAPI // embed to satisfy interface; panics on unimplemented methods
	cfg            *types.Config
	session        *types.ReviewSession
	contentItems   []types.ContentItem
	cleared        bool
}

func (s *stubEngine) GetConfig() *types.Config                  { return s.cfg }
func (s *stubEngine) GetSession() *types.ReviewSession           { return s.session }
func (s *stubEngine) GetFeedbackStatus() string                  { return "" }
func (s *stubEngine) GetAgentStatus() types.AgentStatus          { return types.AgentStatusIdle }
func (s *stubEngine) GetChangedFiles() []types.ChangedFile       { return nil }
func (s *stubEngine) GetAdditionalFiles() []types.AdditionalFile { return nil }
func (s *stubEngine) MarkContentReviewed(id string) error        { return nil }
func (s *stubEngine) UnmarkContentReviewed(id string) error      { return nil }
func (s *stubEngine) GetContentItems() []types.ContentItem       { return s.contentItems }
func (s *stubEngine) GetContentItem(id string) (*types.ContentItem, error) {
	for i := range s.contentItems {
		if s.contentItems[i].ID == id {
			return &s.contentItems[i], nil
		}
	}
	return nil, fmt.Errorf("not found")
}
func (s *stubEngine) ClearComments() error {
	s.cleared = true
	return nil
}

func newTestSession(withComments bool) *types.ReviewSession {
	session := &types.ReviewSession{ID: "test-session"}
	if withComments {
		session.Comments = []types.ReviewComment{
			{ID: "c1", Body: "fix this"},
		}
	}
	return session
}

func TestSubmitSuccess_AlwaysClearsComments(t *testing.T) {
	engine := &stubEngine{
		cfg:     &types.Config{},
		session: newTestSession(true),
	}
	m := NewApp(engine)

	result, _ := m.Update(submitSuccessMsg{agentConnected: true})
	app := result.(appModel)

	if app.overlay == overlayConfirm {
		t.Error("expected no confirm modal — comments should always auto-clear")
	}
	if !engine.cleared {
		t.Error("expected ClearComments to be called")
	}
}

func TestSubmitSuccess_NoComments_SkipsClear(t *testing.T) {
	session := &types.ReviewSession{
		ID:       "test",
		Comments: nil,
	}
	engine := &stubEngine{
		cfg:     &types.Config{},
		session: session,
	}
	m := NewApp(engine)

	_, _ = m.Update(submitSuccessMsg{agentConnected: true})

	if engine.cleared {
		t.Error("expected ClearComments NOT to be called when no comments")
	}
}

func TestSubmitSuccess_AgentDisconnected_PreservesComments(t *testing.T) {
	engine := &stubEngine{
		cfg:     &types.Config{},
		session: newTestSession(true),
	}
	m := NewApp(engine)

	_, cmd := m.Update(submitSuccessMsg{agentConnected: false})

	if cmd != nil {
		t.Error("expected no command when agent disconnected")
	}
	if engine.cleared {
		t.Error("expected ClearComments NOT to be called when agent disconnected")
	}
}

func TestSubmitSuccess_ClearsStaleContentView(t *testing.T) {
	engine := &stubEngine{
		cfg:     &types.Config{},
		session: newTestSession(false),
	}
	m := NewApp(engine)
	m.diffView.contentMode = true
	m.diffView.contentID = "plan-1"
	m.diffView.path = "plan-1"

	result, _ := m.Update(submitSuccessMsg{agentConnected: true})
	app := result.(appModel)

	if app.diffView.contentMode {
		t.Error("expected contentMode to be cleared after submit")
	}
	if app.diffView.contentID != "" {
		t.Errorf("expected contentID to be cleared, got %q", app.diffView.contentID)
	}
	if app.diffView.path != "" {
		t.Errorf("expected path to be cleared, got %q", app.diffView.path)
	}
}
