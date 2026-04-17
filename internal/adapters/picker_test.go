package adapters

import (
	"testing"

	tea "charm.land/bubbletea/v2"
)

// fakeAdapter is a minimal AgentAdapter used only to drive pickerModel tests.
type fakeAdapter struct {
	name, label string
	paths       []string
}

func (f *fakeAdapter) Name() string                     { return f.name }
func (f *fakeAdapter) Label() string                    { return f.label }
func (f *fakeAdapter) Detect() bool                     { return true }
func (f *fakeAdapter) Register(global bool) error       { return nil }
func (f *fakeAdapter) Unregister(global bool) error     { return nil }
func (f *fakeAdapter) HasConfig(global bool) bool       { return false }
func (f *fakeAdapter) ConfigPaths(global bool) []string { return f.paths }
func (f *fakeAdapter) NeedsRegister() bool              { return true }
func (f *fakeAdapter) SetMode(m IntegrationMode)        {}

// keyCodes maps the short names used by pickerModel.Update to the Key.Code
// rune that produces the same msg.String() value in bubbletea v2.
var keyCodes = map[string]rune{
	" ":    tea.KeySpace,
	"down": tea.KeyDown,
	"up":   tea.KeyUp,
}

func keyPress(name string) tea.KeyPressMsg {
	if code, ok := keyCodes[name]; ok {
		return tea.KeyPressMsg{Code: code}
	}
	// single-character keys ("j", "k", "a", etc.)
	runes := []rune(name)
	return tea.KeyPressMsg{Code: runes[0]}
}

func newPicker(agents ...AgentAdapter) pickerModel {
	return pickerModel{
		agents:    agents,
		selected:  map[int]bool{},
		subState:  defaultSubState(),
		subCursor: -1,
		title:     "test",
	}
}

func press(m pickerModel, key string) pickerModel {
	next, _ := m.Update(keyPress(key))
	return next.(pickerModel)
}

func TestPicker_SubRowsHiddenWhenClaudeNotSelected(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	m := newPicker(claude)

	if m.subRowsVisible() {
		t.Fatal("sub-rows should be hidden before Claude is selected")
	}
}

func TestPicker_SelectingClaudeRevealsSubRows(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	m := newPicker(claude)
	m = press(m, " ")

	if !m.selected[0] {
		t.Fatal("Claude should be selected after space")
	}
	if !m.subRowsVisible() {
		t.Fatal("sub-rows should be visible once Claude is selected")
	}
	for _, opt := range claudeSubOptions {
		if !m.subState[opt.id] {
			t.Errorf("sub-option %q should be pre-checked by default", opt.id)
		}
	}
}

func TestPicker_TogglingOneSubRowLeavesOthersAlone(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	other := &fakeAdapter{name: "other", label: "Other"}
	m := newPicker(claude, other)

	m = press(m, " ")    // select Claude (cursor at 0)
	m = press(m, "down") // cursor moves onto first sub-row (plan_hook)
	if !m.onSubRow() || m.subCursor != 0 {
		t.Fatalf("cursor should land on first sub-row, got subCursor=%d", m.subCursor)
	}
	m = press(m, " ") // toggle plan_hook off
	if m.subState["plan_hook"] {
		t.Fatal("plan_hook should be unchecked after toggle")
	}
	if !m.subState["review_gate"] {
		t.Fatal("review_gate should remain checked when only plan_hook was toggled")
	}
	if !m.selected[0] {
		t.Fatal("toggling a sub-row must not affect Claude's selection")
	}
}

func TestPicker_UncheckingClaudeHidesAllSubRows(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	m := newPicker(claude)

	m = press(m, " ") // select Claude
	if !m.subRowsVisible() {
		t.Fatal("precondition: sub-rows visible")
	}
	m = press(m, " ") // deselect Claude
	if m.subRowsVisible() {
		t.Fatal("sub-rows should be hidden after Claude is unchecked")
	}
}

func TestPicker_RecheckingClaudeResetsSubRowsToDefault(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	m := newPicker(claude)

	m = press(m, " ")    // select Claude
	m = press(m, "down") // onto plan_hook sub-row
	m = press(m, " ")    // turn plan_hook off
	m = press(m, "down") // onto review_gate sub-row
	m = press(m, " ")    // turn review_gate off
	m = press(m, "up")   // back to plan_hook
	m = press(m, "up")   // back to Claude row
	m = press(m, " ")    // uncheck Claude
	m = press(m, " ")    // re-check Claude

	for _, opt := range claudeSubOptions {
		if !m.subState[opt.id] {
			t.Errorf("sub-option %q should reset to enabled when Claude is re-checked", opt.id)
		}
	}
}

func TestPicker_NavigationSkipsSubRowsWhenHidden(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	other := &fakeAdapter{name: "other", label: "Other"}
	m := newPicker(claude, other)

	// Claude is unchecked, so down should go straight to the second agent.
	m = press(m, "down")
	if m.onSubRow() {
		t.Fatal("cursor should not land on hidden sub-rows")
	}
	if m.cursor != 1 {
		t.Fatalf("cursor should be on second agent, got %d", m.cursor)
	}
}

func TestPicker_NavigationTraversesBothSubRowsWhenVisible(t *testing.T) {
	claude := &fakeAdapter{name: "claude", label: "Claude"}
	other := &fakeAdapter{name: "other", label: "Other"}
	m := newPicker(claude, other)

	m = press(m, " ")    // select Claude → sub-rows visible
	m = press(m, "down") // onto first sub-row (plan_hook)
	if !m.onSubRow() || m.subCursor != 0 {
		t.Fatalf("down from Claude should land on first sub-row, got subCursor=%d", m.subCursor)
	}
	m = press(m, "down") // onto second sub-row (review_gate)
	if !m.onSubRow() || m.subCursor != 1 {
		t.Fatalf("down should walk into second sub-row, got subCursor=%d", m.subCursor)
	}
	m = press(m, "down") // onto Other
	if m.onSubRow() || m.cursor != 1 {
		t.Fatalf("down from last sub-row should land on Other, got cursor=%d onSub=%v", m.cursor, m.onSubRow())
	}
	m = press(m, "up") // back to last sub-row
	if !m.onSubRow() || m.subCursor != 1 {
		t.Fatalf("up from Other should return to last sub-row, got subCursor=%d", m.subCursor)
	}
	m = press(m, "up") // back to first sub-row
	if !m.onSubRow() || m.subCursor != 0 {
		t.Fatalf("up should step to first sub-row, got subCursor=%d", m.subCursor)
	}
	m = press(m, "up") // back to Claude
	if m.onSubRow() || m.cursor != 0 {
		t.Fatalf("up from first sub-row should land on Claude, got cursor=%d onSub=%v", m.cursor, m.onSubRow())
	}
}
