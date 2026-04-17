package adapters

import (
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// claudeSubOption describes one nested toggle rendered under the Claude
// row when Claude is selected in the picker. Keyed by id so Register can
// interpret the returned state without coupling to the picker's ordering.
type claudeSubOption struct {
	id      string
	label   string
	tagline string
}

// claudeSubOptions is the fixed list of Claude-only sub-toggles. Each is
// checked by default; unchecking translates to a `Skip*` field on the
// returned ClaudeAdapter.
var claudeSubOptions = []claudeSubOption{
	{
		id:      "plan_hook",
		label:   "Install plan review hooks",
		tagline: "(ExitPlanMode → Monocle + pre-plan context)",
	},
	{
		id:      "review_gate",
		label:   "Install turn-end review gate",
		tagline: "(blocks on reviewer after file edits)",
	},
}

// PickAgents shows an interactive multi-select picker and returns the selected adapters.
// The title is shown at the top of the picker (e.g. "Select agents to register").
//
// Side effect: when the Claude adapter is included and any of its nested
// sub-options is unchecked, the matching Skip* field on the returned
// ClaudeAdapter is set so Register() honors the picker's decision.
func PickAgents(agents []AgentAdapter, title string) ([]AgentAdapter, error) {
	m := pickerModel{
		agents:   agents,
		selected: make(map[int]bool),
		title:    title,
		subState: defaultSubState(),
	}
	p := tea.NewProgram(m)
	final, err := p.Run()
	if err != nil {
		return nil, fmt.Errorf("picker: %w", err)
	}
	result := final.(pickerModel)
	if result.cancelled {
		return nil, nil
	}

	var picked []AgentAdapter
	for i, a := range agents {
		if result.selected[i] {
			picked = append(picked, a)
		}
	}

	// Apply the nested toggles back to the Claude adapter.
	for _, a := range picked {
		claude, ok := a.(*ClaudeAdapter)
		if !ok {
			continue
		}
		if !result.subState["plan_hook"] {
			claude.SkipPlanHook = true
		}
		if !result.subState["review_gate"] {
			claude.SkipReviewGate = true
		}
	}
	return picked, nil
}

// defaultSubState returns the initial sub-option state (all checked).
func defaultSubState() map[string]bool {
	s := make(map[string]bool, len(claudeSubOptions))
	for _, o := range claudeSubOptions {
		s[o.id] = true
	}
	return s
}

type pickerModel struct {
	agents    []AgentAdapter
	selected  map[int]bool
	cursor    int
	cancelled bool
	title     string

	// subState maps claudeSubOption.id to its checked state. Only consulted
	// when Claude is selected. Reset to defaults whenever Claude is
	// (re-)checked so opt-outs are a per-register decision, not sticky.
	subState map[string]bool

	// subCursor is the index into claudeSubOptions when the logical cursor
	// is on a sub-row, or -1 when it's on an agent row.
	subCursor int
}

func (m pickerModel) Init() tea.Cmd { return nil }

// claudeIndex returns the index of the Claude adapter in m.agents, or -1.
func (m pickerModel) claudeIndex() int {
	for i, a := range m.agents {
		if a.Name() == "claude" {
			return i
		}
	}
	return -1
}

// subRowsVisible reports whether the nested sub-rows are currently part of
// the navigable list (i.e. Claude exists and is checked).
func (m pickerModel) subRowsVisible() bool {
	idx := m.claudeIndex()
	return idx >= 0 && m.selected[idx]
}

// onSubRow reports whether the cursor is currently on a sub-row.
func (m pickerModel) onSubRow() bool {
	return m.subCursor >= 0
}

func (m pickerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyPressMsg:
		switch msg.String() {
		case "j", "down":
			m = m.moveCursor(+1)
		case "k", "up":
			m = m.moveCursor(-1)
		case "space", " ":
			if m.onSubRow() {
				id := claudeSubOptions[m.subCursor].id
				m.subState[id] = !m.subState[id]
			} else {
				m.selected[m.cursor] = !m.selected[m.cursor]
				// Re-checking Claude resets all sub-options to their defaults.
				if m.cursor == m.claudeIndex() && m.selected[m.cursor] {
					m.subState = defaultSubState()
				}
				// Unchecking Claude hides the sub-rows; pull cursor off them if needed.
				if !m.subRowsVisible() {
					m.subCursor = -1
				}
			}
		case "a":
			allSelected := true
			for i := range m.agents {
				if !m.selected[i] {
					allSelected = false
					break
				}
			}
			for i := range m.agents {
				m.selected[i] = !allSelected
			}
			if !m.subRowsVisible() {
				m.subCursor = -1
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

// moveCursor advances the logical cursor by delta through the visible rows
// (agent rows + any sub-rows directly after Claude when Claude is checked).
func (m pickerModel) moveCursor(delta int) pickerModel {
	claudeIdx := m.claudeIndex()
	subCount := 0
	if m.subRowsVisible() {
		subCount = len(claudeSubOptions)
	}

	if delta > 0 {
		if m.onSubRow() {
			// Advance within sub-rows, or exit to the next agent below Claude.
			if m.subCursor < subCount-1 {
				m.subCursor++
				return m
			}
			m.subCursor = -1
			if m.cursor < len(m.agents)-1 {
				m.cursor++
			}
			return m
		}
		// On an agent row. If it's Claude and sub-rows exist, enter them.
		if m.cursor == claudeIdx && subCount > 0 {
			m.subCursor = 0
			return m
		}
		if m.cursor < len(m.agents)-1 {
			m.cursor++
		}
		return m
	}

	// delta < 0
	if m.onSubRow() {
		if m.subCursor > 0 {
			m.subCursor--
			return m
		}
		// Exit sub-rows back to Claude row.
		m.subCursor = -1
		return m
	}
	// On an agent row below Claude: step back into the last sub-row if visible.
	if m.cursor == claudeIdx+1 && subCount > 0 {
		m.cursor = claudeIdx
		m.subCursor = subCount - 1
		return m
	}
	if m.cursor > 0 {
		m.cursor--
	}
	return m
}

func (m pickerModel) View() tea.View {
	dim := lipgloss.NewStyle().Faint(true)
	cursorStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("6"))
	checkStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("2"))

	var b strings.Builder
	b.WriteString(lipgloss.NewStyle().Bold(true).Render(m.title))
	b.WriteString("\n\n")

	claudeIdx := m.claudeIndex()

	for i, a := range m.agents {
		onAgent := i == m.cursor && !m.onSubRow()
		cursor := "  "
		if onAgent {
			cursor = cursorStyle.Render("> ")
		}

		check := "[ ]"
		if m.selected[i] {
			check = checkStyle.Render("[x]")
		}

		name := a.Label()
		if onAgent {
			name = lipgloss.NewStyle().Bold(true).Render(name)
		}

		paths := a.ConfigPaths(false)

		if onAgent {
			// Expanded: show agent name, then each path on its own line
			b.WriteString(fmt.Sprintf("%s%s %s\n", cursor, check, name))
			for _, p := range paths {
				b.WriteString(fmt.Sprintf("       %s\n", dim.Render("→ "+p)))
			}
		} else {
			// Compact: agent name + summary
			var desc string
			if len(paths) == 1 {
				desc = dim.Render(fmt.Sprintf("(%s)", paths[0]))
			} else {
				desc = dim.Render(fmt.Sprintf("(%s + %d more)", paths[0], len(paths)-1))
			}
			b.WriteString(fmt.Sprintf("%s%s %s %s\n", cursor, check, name, desc))
		}

		// Render the nested sub-rows directly below Claude when it's selected.
		if i == claudeIdx && m.selected[i] {
			for subIdx, opt := range claudeSubOptions {
				cursorCol := "    "
				if m.onSubRow() && m.subCursor == subIdx {
					cursorCol = "  " + cursorStyle.Render("> ")
				}
				box := "[ ]"
				if m.subState[opt.id] {
					box = checkStyle.Render("[x]")
				}
				label := opt.label
				if m.onSubRow() && m.subCursor == subIdx {
					label = lipgloss.NewStyle().Bold(true).Render(label)
				}
				b.WriteString(fmt.Sprintf("%s%s %s %s\n", cursorCol, box, label, dim.Render(opt.tagline)))
			}
		}
	}

	b.WriteString("\n")
	b.WriteString(dim.Render("space: toggle  a: all  enter: confirm  esc: cancel"))

	return tea.NewView(b.String())
}
