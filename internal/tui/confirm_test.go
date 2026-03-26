package tui

import (
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
)

func keyPress(code rune) tea.KeyPressMsg {
	return tea.KeyPressMsg{Code: code}
}

func TestConfirmModel_OpenSetsFields(t *testing.T) {
	m := newConfirmModel(DefaultTheme())
	m.open("Title", "Message", confirmDiscard)

	if !m.active {
		t.Error("expected active after open")
	}
	if m.title != "Title" {
		t.Errorf("expected title 'Title', got %q", m.title)
	}
	if m.action != confirmDiscard {
		t.Error("expected confirmDiscard action")
	}
}

func TestConfirmModel_ConfirmReturnsAction(t *testing.T) {
	m := newConfirmModel(DefaultTheme())
	m.open("Title", "Message", confirmDiscard)

	var cmd tea.Cmd
	m, cmd = m.Update(keyPress('y'))

	if m.active {
		t.Error("expected inactive after confirm")
	}

	msg := cmd()
	action, ok := msg.(confirmActionMsg)
	if !ok {
		t.Fatalf("expected confirmActionMsg, got %T", msg)
	}
	if action.action != confirmDiscard {
		t.Error("expected confirmDiscard action")
	}
}

func TestConfirmModel_CancelReturnsCancelMsg(t *testing.T) {
	m := newConfirmModel(DefaultTheme())
	m.open("Title", "Message", confirmDiscard)

	var cmd tea.Cmd
	m, cmd = m.Update(keyPress(tea.KeyEscape))

	if m.active {
		t.Error("expected inactive after cancel")
	}

	msg := cmd()
	if _, ok := msg.(cancelConfirmMsg); !ok {
		t.Fatalf("expected cancelConfirmMsg, got %T", msg)
	}
}

func TestConfirmModel_ViewRendersContent(t *testing.T) {
	m := newConfirmModel(DefaultTheme())
	m.width = 80
	m.height = 40
	m.open("Confirm", "Are you sure?", confirmDiscard)

	view := m.View()
	if view == "" {
		t.Fatal("expected non-empty view")
	}
	if !strings.Contains(view, "Confirm") {
		t.Error("expected view to contain title")
	}
	if !strings.Contains(view, "Are you sure?") {
		t.Error("expected view to contain message")
	}
}

func TestConfirmModel_InactiveReturnsEmptyView(t *testing.T) {
	m := newConfirmModel(DefaultTheme())
	if m.View() != "" {
		t.Error("expected empty view when inactive")
	}
}

func TestConfirmModel_InactiveIgnoresInput(t *testing.T) {
	m := newConfirmModel(DefaultTheme())
	m, cmd := m.Update(keyPress('y'))
	if cmd != nil {
		t.Error("expected no command when inactive")
	}
	if m.active {
		t.Error("expected model to remain inactive")
	}
}
