package adapters

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// IntegrationMode describes how an agent integrates with Monocle.
type IntegrationMode string

const (
	// ModeMCPTools uses MCP tools for all operations (recommended).
	ModeMCPTools IntegrationMode = "mcp-tools"

	// ModeSkills uses skill files and CLI commands with MCP channel notifications.
	ModeSkills IntegrationMode = "skills"
)

type modeOption struct {
	mode IntegrationMode
	name string
	desc string
}

var modeOptions = []modeOption{
	{ModeMCPTools, "MCP Tools", "Agent calls Monocle via MCP tool invocations (recommended)"},
	{ModeSkills, "Skills", "Agent runs monocle CLI commands via skill instructions"},
}

// PickIntegrationMode shows an interactive picker for choosing between
// MCP tools and skills integration. Returns the selected mode.
func PickIntegrationMode() (IntegrationMode, error) {
	m := modePickerModel{}
	p := tea.NewProgram(m)
	final, err := p.Run()
	if err != nil {
		return "", fmt.Errorf("mode picker: %w", err)
	}
	result := final.(modePickerModel)
	if result.cancelled {
		return "", nil
	}
	return modeOptions[result.cursor].mode, nil
}

type modePickerModel struct {
	cursor    int
	cancelled bool
}

func (m modePickerModel) Init() tea.Cmd { return nil }

func (m modePickerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		switch msg.String() {
		case "j", "down":
			if m.cursor < len(modeOptions)-1 {
				m.cursor++
			}
		case "k", "up":
			if m.cursor > 0 {
				m.cursor--
			}
		case "enter":
			return m, tea.Quit
		case "esc", "q", "ctrl+c":
			m.cancelled = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m modePickerModel) View() tea.View {
	var b strings.Builder
	b.WriteString(lipgloss.NewStyle().Bold(true).Render("How should this agent integrate with Monocle?"))
	b.WriteString("\n\n")

	for i, opt := range modeOptions {
		cursor := "  "
		if i == m.cursor {
			cursor = lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Render("> ")
		}

		name := opt.name
		if i == m.cursor {
			name = lipgloss.NewStyle().Bold(true).Render(name)
		}

		desc := lipgloss.NewStyle().Faint(true).Render(opt.desc)
		b.WriteString(fmt.Sprintf("%s%s — %s\n", cursor, name, desc))
	}

	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Faint(true).Render("↑/↓: navigate  enter: select  esc: cancel"))

	return tea.NewView(b.String())
}
