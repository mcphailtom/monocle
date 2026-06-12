package adapters

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	piMCPAdapterPackage = "npm:pi-mcp-adapter@2.9.0"
	piPromptMarker      = "<!-- monocle-managed-prompt: true -->"
)

// PiAdapter handles Monocle registration for Pi.
type PiAdapter struct {
	Mode IntegrationMode
}

func (a *PiAdapter) Name() string              { return "pi" }
func (a *PiAdapter) Label() string             { return "Pi" }
func (a *PiAdapter) SetMode(m IntegrationMode) { a.Mode = m }

func (a *PiAdapter) effectiveMode(global bool) IntegrationMode {
	if a.Mode == "" {
		return DefaultIntegrationModeForScope(a.Name(), global)
	}
	return a.Mode
}

func (a *PiAdapter) ConfigPaths(global bool) []string {
	paths := PiPromptPaths(piPromptsDir(global))
	if a.effectiveMode(global) == ModeMCPTools {
		configPaths := []string{piMCPConfigPath(global)}
		if a.Mode == ModeMCPTools {
			configPaths = append([]string{piSettingsPath(global)}, configPaths...)
		}
		return append(configPaths, paths...)
	}
	return append(SkillPaths(piSkillsDir(global)), paths...)
}

func (a *PiAdapter) HasConfig(global bool) bool {
	if hasPiMCPEntry(piMCPConfigPath(global)) {
		return true
	}
	for _, name := range SkillNames {
		if _, err := os.Stat(filepath.Join(piSkillsDir(global), name, "SKILL.md")); err == nil {
			return true
		}
	}
	return hasManagedPiPrompts(piPromptsDir(global))
}

func (a *PiAdapter) Register(global bool) error {
	mode := a.effectiveMode(global)

	if mode == ModeMCPTools {
		if err := checkPiPromptsWritable(piPromptsDir(global), mode); err != nil {
			return fmt.Errorf("install prompts: %w", err)
		}
		if a.Mode == ModeMCPTools {
			if err := configurePiPackage(piSettingsPath(global)); err != nil {
				return fmt.Errorf("configure pi package: %w", err)
			}
		}
		if err := configurePiMCP(piMCPConfigPath(global), ResolveCommand(global)); err != nil {
			return fmt.Errorf("configure mcp: %w", err)
		}
		if err := InstallPiPrompts(piPromptsDir(global), mode); err != nil {
			return fmt.Errorf("install prompts: %w", err)
		}
		RemoveSkills(piSkillsDir(global))
		return nil
	}

	if err := InstallPiPrompts(piPromptsDir(global), mode); err != nil {
		return fmt.Errorf("install prompts: %w", err)
	}
	_ = unconfigurePiMCP(piMCPConfigPath(global))
	return InstallSkills(piSkillsDir(global))
}

func (a *PiAdapter) Unregister(global bool) error {
	if err := unconfigurePiMCP(piMCPConfigPath(global)); err != nil {
		return fmt.Errorf("unconfigure mcp: %w", err)
	}
	RemoveSkills(piSkillsDir(global))
	RemovePiPrompts(piPromptsDir(global))
	// Keep pi-mcp-adapter installed; other Pi MCP servers may depend on it.
	return nil
}

// Detect returns true if Pi appears to be installed.
func (a *PiAdapter) Detect() bool {
	if _, err := exec.LookPath("pi"); err == nil {
		return true
	}
	if _, err := os.Stat(".pi"); err == nil {
		return true
	}
	return false
}

func piSettingsPath(global bool) string {
	if global {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".pi", "agent", "settings.json")
		}
	}
	return filepath.Join(".pi", "settings.json")
}

func piMCPConfigPath(global bool) string {
	if global {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".pi", "agent", "mcp.json")
		}
	}
	return filepath.Join(".pi", "mcp.json")
}

func piSkillsDir(global bool) string {
	if global {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".pi", "agent", "skills")
		}
	}
	return filepath.Join(".pi", "skills")
}

func piPromptsDir(global bool) string {
	if global {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, ".pi", "agent", "prompts")
		}
	}
	return filepath.Join(".pi", "prompts")
}

// PiMCPAdapterConfigured reports whether pi-mcp-adapter is already configured for Pi.
func PiMCPAdapterConfigured(global bool) bool {
	if hasPiMCPAdapterPackage(piSettingsPath(global)) {
		return true
	}
	// Project Pi sessions also load user-level packages, so a globally configured
	// adapter means project-local auto registration can use MCP without adding it.
	return !global && hasPiMCPAdapterPackage(piSettingsPath(true))
}

func hasPiMCPAdapterPackage(path string) bool {
	data, err := ReadJSONFile(path)
	if err != nil {
		return false
	}
	packagesRaw, ok := data["packages"].([]any)
	if !ok {
		return false
	}
	for _, entry := range packagesRaw {
		if isPiMCPAdapterPackage(entry) {
			return true
		}
	}
	return false
}

func configurePiPackage(path string) error {
	data, err := ReadJSONFile(path)
	if err != nil {
		return err
	}

	packagesRaw, ok := data["packages"].([]any)
	if !ok {
		if _, exists := data["packages"]; exists {
			return fmt.Errorf("packages in %s must be an array", path)
		}
		packagesRaw = []any{}
	}

	for _, entry := range packagesRaw {
		if isPiMCPAdapterPackage(entry) {
			return nil
		}
	}

	data["packages"] = append(packagesRaw, piMCPAdapterPackage)
	return WriteJSONFile(path, data)
}

func isPiMCPAdapterPackage(entry any) bool {
	source, ok := entry.(string)
	if !ok {
		m, ok := entry.(map[string]any)
		if !ok {
			return false
		}
		source, _ = m["source"].(string)
	}
	return isPiMCPAdapterSource(source)
}

func isPiMCPAdapterSource(source string) bool {
	source = strings.TrimSpace(source)
	source = strings.TrimPrefix(source, "npm:")
	if source == "pi-mcp-adapter" {
		return true
	}
	return strings.HasPrefix(source, "pi-mcp-adapter@")
}

func configurePiMCP(path, command string) error {
	data, err := ReadJSONFile(path)
	if err != nil {
		return err
	}

	servers := piMCPServersForWrite(data)
	servers["monocle"] = map[string]any{
		"command":     command,
		"args":        []any{"serve-mcp"},
		"lifecycle":   "lazy",
		"directTools": []any{"review_status", "get_feedback", "send_artifact"},
	}

	return WriteJSONFile(path, data)
}

func unconfigurePiMCP(path string) error {
	data, err := ReadJSONFile(path)
	if err != nil {
		return err
	}
	if !hasPiMCPEntryInConfig(data) {
		return nil
	}

	for _, key := range []string{"mcpServers", "mcp-servers"} {
		servers, ok := data[key].(map[string]any)
		if !ok {
			continue
		}
		if entry, ok := servers["monocle"].(map[string]any); ok && isPiMCPEntry(entry) {
			delete(servers, "monocle")
		}
		if len(servers) == 0 {
			delete(data, key)
		}
	}
	if len(data) == 0 {
		return RemoveFileIfExists(path)
	}
	return WriteJSONFile(path, data)
}

func hasPiMCPEntry(path string) bool {
	data, err := ReadJSONFile(path)
	if err != nil {
		return false
	}
	return hasPiMCPEntryInConfig(data)
}

func hasPiMCPEntryInConfig(data map[string]any) bool {
	for _, key := range []string{"mcpServers", "mcp-servers"} {
		servers, ok := data[key].(map[string]any)
		if !ok {
			continue
		}
		entry, ok := servers["monocle"].(map[string]any)
		if ok && isPiMCPEntry(entry) {
			return true
		}
	}
	return false
}

func isPiMCPEntry(entry map[string]any) bool {
	args, _ := entry["args"].([]any)
	if len(args) == 0 {
		return false
	}
	arg, _ := args[0].(string)
	return arg == "serve-mcp"
}

// piMCPServersForWrite returns the MCP server map Monocle should edit.
// pi-mcp-adapter 2.9.0 reads both mcpServers and the compatibility mcp-servers key;
// keep user-owned sibling servers in their existing key instead of migrating them.
func piMCPServersForWrite(data map[string]any) map[string]any {
	if servers, ok := data["mcpServers"].(map[string]any); ok {
		return servers
	}
	if servers, ok := data["mcp-servers"].(map[string]any); ok {
		return servers
	}
	servers := map[string]any{}
	data["mcpServers"] = servers
	return servers
}

type piPromptDef struct {
	Name         string
	Description  string
	ArgumentHint string
	Body         string
}

// InstallPiPrompts writes Pi prompt templates with a Monocle ownership marker.
func InstallPiPrompts(dir string, mode IntegrationMode) error {
	if err := checkPiPromptsWritable(dir, mode); err != nil {
		return err
	}

	for _, prompt := range piPromptDefs(mode) {
		path := filepath.Join(dir, prompt.Name+".md")
		if err := WriteFileAtomic(path, []byte(renderPiPrompt(prompt))); err != nil {
			return fmt.Errorf("write prompt %s: %w", prompt.Name, err)
		}
	}
	return nil
}

func checkPiPromptsWritable(dir string, mode IntegrationMode) error {
	for _, prompt := range piPromptDefs(mode) {
		path := filepath.Join(dir, prompt.Name+".md")
		content, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return fmt.Errorf("read prompt %s: %w", prompt.Name, err)
		}
		if !strings.Contains(string(content), piPromptMarker) {
			return fmt.Errorf("%s already exists and is not managed by monocle", path)
		}
	}
	return nil
}

// RemovePiPrompts removes only Monocle-managed Pi prompt templates.
func RemovePiPrompts(dir string) {
	for _, prompt := range piPromptDefs(ModeMCPTools) {
		path := filepath.Join(dir, prompt.Name+".md")
		content, err := os.ReadFile(path)
		if err != nil || !strings.Contains(string(content), piPromptMarker) {
			continue
		}
		_ = RemoveFileIfExists(path)
	}
	_ = os.Remove(dir)
}

// PiPromptPaths returns the paths of installed Pi prompt templates.
func PiPromptPaths(dir string) []string {
	defs := piPromptDefs(ModeMCPTools)
	paths := make([]string, len(defs))
	for i, prompt := range defs {
		paths[i] = filepath.Join(dir, prompt.Name+".md")
	}
	return paths
}

func hasManagedPiPrompts(dir string) bool {
	for _, prompt := range piPromptDefs(ModeMCPTools) {
		content, err := os.ReadFile(filepath.Join(dir, prompt.Name+".md"))
		if err == nil && strings.Contains(string(content), piPromptMarker) {
			return true
		}
	}
	return false
}

func renderPiPrompt(prompt piPromptDef) string {
	var b strings.Builder
	b.WriteString("---\n")
	b.WriteString("description: ")
	b.WriteString(strconv.Quote(prompt.Description))
	b.WriteString("\n")
	if prompt.ArgumentHint != "" {
		b.WriteString("argument-hint: ")
		b.WriteString(strconv.Quote(prompt.ArgumentHint))
		b.WriteString("\n")
	}
	b.WriteString("---\n\n")
	b.WriteString(piPromptMarker)
	b.WriteString("\n\n")
	b.WriteString(strings.TrimSpace(prompt.Body))
	b.WriteString("\n")
	return b.String()
}

func piPromptDefs(mode IntegrationMode) []piPromptDef {
	if mode == ModeSkills {
		return []piPromptDef{
			{
				Name:        "get-feedback",
				Description: "Retrieve review feedback from Monocle",
				Body: "Run `monocle review get-feedback` to retrieve pending review feedback.\n\n" +
					"If feedback is available, read it carefully, address the reviewer's comments, and continue your work. If no feedback is pending, tell the user no review feedback is available yet.",
			},
			{
				Name:        "get-feedback-wait",
				Description: "Block until reviewer submits feedback",
				Body: "Run `monocle review get-feedback --wait` to block until the reviewer submits feedback through Monocle.\n\n" +
					"Read the feedback carefully and address it. If the reviewer requested changes, run the command again after making updates and keep iterating until the reviewer approves.",
			},
			{
				Name:         "review-plan",
				Description:  "Send a plan to Monocle for review",
				ArgumentHint: "[plan-file]",
				Body: "Submit a plan file to Monocle so the reviewer can see it. This returns immediately without waiting for feedback.\n\n" +
					"1. If `$ARGUMENTS` includes a path, use that plan file. Otherwise, find the most recently modified plan file in the project. Only submit user-approved files under the current repository; do not submit hidden, secret-looking, credential, or environment files.\n" +
					"2. Read the plan file to confirm it exists and get its filename.\n" +
					"3. Run `monocle review send-artifact --title <title> --file <absolute-path> --id <filename> --type md`. Use the first markdown heading as the title, or the filename if there is no heading.\n" +
					"4. Confirm to the user that the plan was sent to Monocle.",
			},
			{
				Name:         "review-plan-wait",
				Description:  "Send a plan and wait for review feedback",
				ArgumentHint: "[plan-file]",
				Body: "Submit a plan file to Monocle and block until the reviewer responds with feedback.\n\n" +
					"1. If `$ARGUMENTS` includes a path, use that plan file. Otherwise, find the most recently modified plan file in the project. Only submit user-approved files under the current repository; do not submit hidden, secret-looking, credential, or environment files.\n" +
					"2. Read the plan file to confirm it exists and get its filename.\n" +
					"3. Run `monocle review send-artifact --wait --title <title> --file <absolute-path> --id <filename> --type md`. Use the first markdown heading as the title, or the filename if there is no heading.\n" +
					"4. If the reviewer requests changes, update the plan and repeat until the reviewer approves.",
			},
		}
	}

	return []piPromptDef{
		{
			Name:        "get-feedback",
			Description: "Retrieve review feedback from Monocle",
			Body: "Retrieve pending review feedback through Pi's MCP adapter.\n\n" +
				"Use the direct `monocle_get_feedback` tool if it is available. Otherwise call Pi's MCP gateway with `mcp({ tool: \"monocle_get_feedback\", args: \"{}\" })`.\n\n" +
				"If feedback is available, read it carefully, address the reviewer's comments, and continue your work. If no feedback is pending, tell the user no review feedback is available yet.",
		},
		{
			Name:        "get-feedback-wait",
			Description: "Block until reviewer submits feedback",
			Body: "Block until the reviewer submits feedback through Monocle.\n\n" +
				"Use the direct `monocle_get_feedback` tool with `wait=true` if it is available. Otherwise call Pi's MCP gateway with `mcp({ tool: \"monocle_get_feedback\", args: \"{\\\"wait\\\":true}\" })`.\n\n" +
				"Read the feedback carefully and address it. If the reviewer requested changes, wait for feedback again after making updates and keep iterating until the reviewer approves.",
		},
		{
			Name:         "review-plan",
			Description:  "Send a plan to Monocle for review",
			ArgumentHint: "[plan-file]",
			Body: "Submit a plan file to Monocle through Pi's MCP adapter. This returns immediately without waiting for feedback.\n\n" +
				"1. If `$ARGUMENTS` includes a path, use that plan file. Otherwise, find the most recently modified plan file in the project. Only submit user-approved files under the current repository; do not submit hidden, secret-looking, credential, or environment files.\n" +
				"2. Read the plan file to confirm it exists and get its filename.\n" +
				"3. Use the direct `monocle_send_artifact` tool if it is available. Otherwise call Pi's MCP gateway with `mcp({ tool: \"monocle_send_artifact\", args: \"<json>\" })`.\n" +
				"4. Pass `title`, `file_path`, `id`, and `content_type`. Use the first markdown heading as the title, the absolute repo-local plan path as `file_path`, the filename as `id`, and `md` as `content_type`.\n" +
				"5. Confirm to the user that the plan was sent to Monocle.",
		},
		{
			Name:         "review-plan-wait",
			Description:  "Send a plan and wait for review feedback",
			ArgumentHint: "[plan-file]",
			Body: "Submit a plan file to Monocle through Pi's MCP adapter, then block until the reviewer responds.\n\n" +
				"1. If `$ARGUMENTS` includes a path, use that plan file. Otherwise, find the most recently modified plan file in the project. Only submit user-approved files under the current repository; do not submit hidden, secret-looking, credential, or environment files.\n" +
				"2. Read the plan file to confirm it exists and get its filename.\n" +
				"3. Use the direct `monocle_send_artifact` tool if it is available. Otherwise call Pi's MCP gateway with `mcp({ tool: \"monocle_send_artifact\", args: \"<json>\" })`.\n" +
				"4. Pass `title`, `file_path`, `id`, and `content_type`. Use the first markdown heading as the title, the absolute repo-local plan path as `file_path`, the filename as `id`, and `md` as `content_type`.\n" +
				"5. Call the direct `monocle_get_feedback` tool with `wait=true` if it is available. Otherwise call Pi's MCP gateway with `mcp({ tool: \"monocle_get_feedback\", args: \"{\\\"wait\\\":true}\" })`.\n" +
				"6. If the reviewer requests changes, update the plan and repeat until the reviewer approves.",
		},
	}
}
