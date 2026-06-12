package adapters

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPiRegister_MCPToolsMode(t *testing.T) {
	projDir := setupPiProject(t)

	adapter := &PiAdapter{Mode: ModeMCPTools}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("register: %v", err)
	}

	settings, err := ReadJSONFile(filepath.Join(projDir, ".pi", "settings.json"))
	if err != nil {
		t.Fatalf("read settings: %v", err)
	}
	packages, ok := settings["packages"].([]any)
	if !ok {
		t.Fatal("settings packages should exist")
	}
	if len(packages) != 1 || packages[0] != piMCPAdapterPackage {
		t.Fatalf("packages = %#v, want %q", packages, piMCPAdapterPackage)
	}

	mcp, err := ReadJSONFile(filepath.Join(projDir, ".pi", "mcp.json"))
	if err != nil {
		t.Fatalf("read mcp config: %v", err)
	}
	servers := mcp["mcpServers"].(map[string]any)
	monocle := servers["monocle"].(map[string]any)
	if monocle["command"] != "monocle" {
		t.Fatalf("command = %v, want monocle", monocle["command"])
	}
	args := monocle["args"].([]any)
	if len(args) != 1 || args[0] != "serve-mcp" {
		t.Fatalf("args = %#v, want serve-mcp", args)
	}
	if monocle["lifecycle"] != "lazy" {
		t.Fatalf("lifecycle = %v, want lazy", monocle["lifecycle"])
	}
	directTools := monocle["directTools"].([]any)
	if len(directTools) != 3 {
		t.Fatalf("directTools = %#v, want 3 tools", directTools)
	}
	for _, tool := range directTools {
		if tool == "add_files" {
			t.Fatal("Pi MCP mode should leave add_files behind the proxy tool")
		}
	}

	for _, name := range CommandNames() {
		path := filepath.Join(projDir, ".pi", "prompts", name+".md")
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("prompt %s not found: %v", name, err)
		}
		if !strings.Contains(string(content), piPromptMarker) {
			t.Fatalf("prompt %s missing marker", name)
		}
	}

	if !adapter.HasConfig(false) {
		t.Fatal("expected adapter to report config after register")
	}
}

func TestPiRegister_SkillsMode(t *testing.T) {
	setupTestSkills(t)
	projDir := setupPiProject(t)

	adapter := &PiAdapter{Mode: ModeSkills}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("register: %v", err)
	}

	for _, name := range SkillNames {
		path := filepath.Join(projDir, ".pi", "skills", name, "SKILL.md")
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("skill %s not found: %v", name, err)
		}
	}
	for _, name := range CommandNames() {
		path := filepath.Join(projDir, ".pi", "prompts", name+".md")
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("prompt %s not found: %v", name, err)
		}
		if !strings.Contains(string(content), "monocle review") {
			t.Fatalf("skills prompt %s should use CLI commands", name)
		}
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "mcp.json")); !os.IsNotExist(err) {
		t.Fatal("skills mode should not leave a Pi MCP config")
	}
}

func TestPiRegister_AutoModeFallsBackToSkillsWhenAdapterMissing(t *testing.T) {
	setupTestSkills(t)
	projDir := setupPiProject(t)

	adapter := &PiAdapter{}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("register: %v", err)
	}

	if _, err := os.Stat(filepath.Join(projDir, ".pi", "skills", "get-feedback", "SKILL.md")); err != nil {
		t.Fatalf("auto mode without pi-mcp-adapter should install skills: %v", err)
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "mcp.json")); !os.IsNotExist(err) {
		t.Fatal("auto mode without pi-mcp-adapter should not write MCP config")
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "settings.json")); !os.IsNotExist(err) {
		t.Fatal("auto mode without pi-mcp-adapter should not add Pi packages")
	}
}

func TestPiRegister_AutoModeUsesMCPWhenAdapterConfigured(t *testing.T) {
	projDir := setupPiProject(t)
	settingsPath := filepath.Join(projDir, ".pi", "settings.json")
	if err := WriteJSONFile(settingsPath, map[string]any{"packages": []any{piMCPAdapterPackage}}); err != nil {
		t.Fatal(err)
	}

	adapter := &PiAdapter{}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("register: %v", err)
	}

	if _, err := os.Stat(filepath.Join(projDir, ".pi", "mcp.json")); err != nil {
		t.Fatalf("auto mode with pi-mcp-adapter should write MCP config: %v", err)
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "skills", "get-feedback", "SKILL.md")); !os.IsNotExist(err) {
		t.Fatal("auto mode with pi-mcp-adapter should not install skills")
	}
}

func TestPiRegister_AutoModeUsesGlobalAdapterWithoutProjectPackage(t *testing.T) {
	projDir := setupPiProject(t)
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	if err := WriteJSONFile(filepath.Join(home, ".pi", "agent", "settings.json"), map[string]any{"packages": []any{piMCPAdapterPackage}}); err != nil {
		t.Fatal(err)
	}

	adapter := &PiAdapter{}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("register: %v", err)
	}

	if _, err := os.Stat(filepath.Join(projDir, ".pi", "mcp.json")); err != nil {
		t.Fatalf("auto mode with global pi-mcp-adapter should write MCP config: %v", err)
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "settings.json")); !os.IsNotExist(err) {
		t.Fatal("auto mode with only global pi-mcp-adapter should not add project Pi packages")
	}
}

func TestPiDefaultIntegrationModeUsesGlobalAdapterForProjectScope(t *testing.T) {
	dir := t.TempDir()
	home := filepath.Join(dir, "home")
	t.Setenv("HOME", home)
	if err := WriteJSONFile(filepath.Join(home, ".pi", "agent", "settings.json"), map[string]any{"packages": []any{piMCPAdapterPackage}}); err != nil {
		t.Fatal(err)
	}

	if got := DefaultIntegrationModeForScope("pi", false); got != ModeMCPTools {
		t.Fatalf("project-scope default = %s, want %s", got, ModeMCPTools)
	}
	if got := DefaultIntegrationModeForScope("pi", true); got != ModeMCPTools {
		t.Fatalf("global-scope default = %s, want %s", got, ModeMCPTools)
	}
}

func TestPiRegister_DoesNotClobberUserPrompt(t *testing.T) {
	projDir := setupPiProject(t)
	promptPath := filepath.Join(projDir, ".pi", "prompts", "get-feedback.md")
	if err := os.MkdirAll(filepath.Dir(promptPath), 0755); err != nil {
		t.Fatal(err)
	}
	original := "---\ndescription: user prompt\n---\n\nuser-owned\n"
	if err := os.WriteFile(promptPath, []byte(original), 0644); err != nil {
		t.Fatal(err)
	}

	adapter := &PiAdapter{Mode: ModeMCPTools}
	err := adapter.Register(false)
	if err == nil {
		t.Fatal("expected register to fail on user-owned prompt")
	}
	if !strings.Contains(err.Error(), "not managed by monocle") {
		t.Fatalf("error = %v, want ownership message", err)
	}

	content, err := os.ReadFile(promptPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != original {
		t.Fatalf("user prompt was modified:\n%s", content)
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "mcp.json")); !os.IsNotExist(err) {
		t.Fatal("register should stop before writing MCP config on prompt collision")
	}
}

func TestPiUnregister_RemovesManagedPromptsOnly(t *testing.T) {
	projDir := setupPiProject(t)
	promptDir := filepath.Join(projDir, ".pi", "prompts")
	if err := os.MkdirAll(promptDir, 0755); err != nil {
		t.Fatal(err)
	}
	managed := filepath.Join(promptDir, "review-plan.md")
	if err := os.WriteFile(managed, []byte(piPromptMarker+"\nmanaged\n"), 0644); err != nil {
		t.Fatal(err)
	}
	userOwned := filepath.Join(promptDir, "get-feedback.md")
	if err := os.WriteFile(userOwned, []byte("user-owned\n"), 0644); err != nil {
		t.Fatal(err)
	}

	adapter := &PiAdapter{}
	if err := adapter.Unregister(false); err != nil {
		t.Fatalf("unregister: %v", err)
	}

	if _, err := os.Stat(managed); !os.IsNotExist(err) {
		t.Fatal("managed prompt should be removed")
	}
	content, err := os.ReadFile(userOwned)
	if err != nil {
		t.Fatalf("user prompt should be preserved: %v", err)
	}
	if string(content) != "user-owned\n" {
		t.Fatalf("user prompt changed: %q", content)
	}
}

func TestPiRegister_MCPToolsModeRemovesStaleSkills(t *testing.T) {
	setupTestSkills(t)
	projDir := setupPiProject(t)

	adapter := &PiAdapter{Mode: ModeSkills}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("skills register: %v", err)
	}
	staleSkill := filepath.Join(projDir, ".pi", "skills", "get-feedback", "SKILL.md")
	if _, err := os.Stat(staleSkill); err != nil {
		t.Fatalf("skill should exist before MCP register: %v", err)
	}

	adapter.Mode = ModeMCPTools
	if err := adapter.Register(false); err != nil {
		t.Fatalf("mcp register: %v", err)
	}
	if _, err := os.Stat(staleSkill); !os.IsNotExist(err) {
		t.Fatal("MCP mode should remove stale Pi skills")
	}
}

func TestPiRegister_MCPToolsModePreservesSkillsOnPackageError(t *testing.T) {
	setupTestSkills(t)
	projDir := setupPiProject(t)

	adapter := &PiAdapter{Mode: ModeSkills}
	if err := adapter.Register(false); err != nil {
		t.Fatalf("skills register: %v", err)
	}
	staleSkill := filepath.Join(projDir, ".pi", "skills", "get-feedback", "SKILL.md")
	if _, err := os.Stat(staleSkill); err != nil {
		t.Fatalf("skill should exist before MCP register: %v", err)
	}
	settingsPath := filepath.Join(projDir, ".pi", "settings.json")
	if err := WriteJSONFile(settingsPath, map[string]any{"packages": "not-an-array"}); err != nil {
		t.Fatal(err)
	}

	adapter.Mode = ModeMCPTools
	if err := adapter.Register(false); err == nil {
		t.Fatal("expected MCP register to fail on invalid packages")
	}
	if _, err := os.Stat(staleSkill); err != nil {
		t.Fatalf("skills should remain when MCP setup fails: %v", err)
	}
	if _, err := os.Stat(filepath.Join(projDir, ".pi", "mcp.json")); !os.IsNotExist(err) {
		t.Fatal("MCP config should not be written after package setup fails")
	}
}

func TestPiUnregister_RemovesLegacyMCPEntry(t *testing.T) {
	projDir := setupPiProject(t)
	mcpPath := filepath.Join(projDir, ".pi", "mcp.json")
	existing := map[string]any{
		"mcp-servers": map[string]any{
			"monocle": map[string]any{
				"command": "monocle",
				"args":    []any{"serve-mcp"},
			},
			"other": map[string]any{
				"command": "other-mcp",
			},
		},
	}
	if err := WriteJSONFile(mcpPath, existing); err != nil {
		t.Fatal(err)
	}

	adapter := &PiAdapter{}
	if !adapter.HasConfig(false) {
		t.Fatal("legacy MCP entry should be detected")
	}
	if err := adapter.Unregister(false); err != nil {
		t.Fatalf("unregister: %v", err)
	}

	data, err := ReadJSONFile(mcpPath)
	if err != nil {
		t.Fatal(err)
	}
	servers := data["mcp-servers"].(map[string]any)
	if _, ok := servers["monocle"]; ok {
		t.Fatal("monocle server should be removed")
	}
	if _, ok := servers["other"]; !ok {
		t.Fatal("other server should be preserved")
	}
}

func TestPiUnregister_PreservesUserOwnedMonocleServer(t *testing.T) {
	projDir := setupPiProject(t)
	mcpPath := filepath.Join(projDir, ".pi", "mcp.json")
	existing := map[string]any{
		"mcpServers": map[string]any{
			"monocle": map[string]any{
				"command": "user-monocle",
				"args":    []any{"not-serve-mcp"},
			},
		},
	}
	if err := WriteJSONFile(mcpPath, existing); err != nil {
		t.Fatal(err)
	}

	adapter := &PiAdapter{}
	if adapter.HasConfig(false) {
		t.Fatal("user-owned monocle server should not count as Monocle config")
	}
	if err := adapter.Unregister(false); err != nil {
		t.Fatalf("unregister: %v", err)
	}

	data, err := ReadJSONFile(mcpPath)
	if err != nil {
		t.Fatal(err)
	}
	servers := data["mcpServers"].(map[string]any)
	if _, ok := servers["monocle"]; !ok {
		t.Fatal("user-owned monocle server should be preserved")
	}
}

func TestUnconfigurePiMCP_DoesNotRewriteWhenMonocleMissing(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mcp.json")
	existing := map[string]any{
		"mcp-servers": map[string]any{
			"other": map[string]any{
				"command": "other-mcp",
			},
		},
	}
	if err := WriteJSONFile(path, existing); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	if err := unconfigurePiMCP(path); err != nil {
		t.Fatalf("unconfigure mcp: %v", err)
	}

	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(before) {
		t.Fatal("unconfigure should not rewrite MCP config when monocle is absent")
	}
}

func TestHasPiMCPEntry_DoesNotMutateLegacyConfig(t *testing.T) {
	data := map[string]any{
		"mcp-servers": map[string]any{
			"monocle": map[string]any{
				"command": "monocle",
				"args":    []any{"serve-mcp"},
			},
		},
	}

	if !hasPiMCPEntryInConfig(data) {
		t.Fatal("legacy Monocle MCP entry should be detected")
	}
	if _, ok := data["mcp-servers"]; !ok {
		t.Fatal("read-only detection should not remove legacy key")
	}
	if _, ok := data["mcpServers"]; ok {
		t.Fatal("read-only detection should not add canonical key")
	}
}

func TestConfigurePiMCP_PreservesExistingLegacyKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mcp.json")
	existing := map[string]any{
		"mcp-servers": map[string]any{
			"other": map[string]any{
				"command": "other-mcp",
			},
		},
	}
	if err := WriteJSONFile(path, existing); err != nil {
		t.Fatal(err)
	}

	if err := configurePiMCP(path, "monocle"); err != nil {
		t.Fatalf("configure mcp: %v", err)
	}

	data, err := ReadJSONFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := data["mcpServers"]; ok {
		t.Fatal("legacy-only config should not be migrated to mcpServers")
	}
	servers := data["mcp-servers"].(map[string]any)
	if _, ok := servers["other"]; !ok {
		t.Fatal("existing server should be preserved")
	}
	if _, ok := servers["monocle"]; !ok {
		t.Fatal("monocle server should be added")
	}
}

func TestConfigurePiMCP_PreservesMixedKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mcp.json")
	existing := map[string]any{
		"mcp-servers": map[string]any{
			"legacy": map[string]any{
				"command": "legacy-mcp",
			},
		},
		"mcpServers": map[string]any{
			"modern": map[string]any{
				"command": "modern-mcp",
			},
		},
	}
	if err := WriteJSONFile(path, existing); err != nil {
		t.Fatal(err)
	}

	if err := configurePiMCP(path, "monocle"); err != nil {
		t.Fatalf("configure mcp: %v", err)
	}

	data, err := ReadJSONFile(path)
	if err != nil {
		t.Fatal(err)
	}
	legacy := data["mcp-servers"].(map[string]any)
	if _, ok := legacy["legacy"]; !ok {
		t.Fatal("legacy server should be preserved under legacy key")
	}
	modern := data["mcpServers"].(map[string]any)
	if _, ok := modern["modern"]; !ok {
		t.Fatal("modern server should be preserved")
	}
	if _, ok := modern["monocle"]; !ok {
		t.Fatal("monocle server should be added under canonical key when present")
	}
}

func TestPiPrompts_MCPReviewPlanWaitUsesGetFeedbackWait(t *testing.T) {
	var body string
	for _, prompt := range piPromptDefs(ModeMCPTools) {
		if prompt.Name == "review-plan-wait" {
			body = prompt.Body
			break
		}
	}
	if body == "" {
		t.Fatal("review-plan-wait prompt not found")
	}
	if !strings.Contains(body, "monocle_get_feedback") {
		t.Fatalf("MCP review-plan-wait prompt should call get_feedback, got:\n%s", body)
	}
	if !strings.Contains(body, "wait=true") {
		t.Fatalf("MCP review-plan-wait prompt should wait for feedback, got:\n%s", body)
	}
	if strings.Contains(body, "content_type`, and `wait: true") {
		t.Fatalf("MCP send_artifact prompt should not include wait parameter, got:\n%s", body)
	}
}

func TestConfigurePiPackage_IdempotentWithExistingObject(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	existing := map[string]any{
		"packages": []any{
			map[string]any{"source": "npm:pi-mcp-adapter@2.9.0"},
			"npm:other-package",
		},
	}
	if err := WriteJSONFile(path, existing); err != nil {
		t.Fatal(err)
	}

	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	if err := configurePiPackage(path); err != nil {
		t.Fatalf("configure package: %v", err)
	}

	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(before) {
		t.Fatal("settings should not be rewritten when package is already configured")
	}

	data, err := ReadJSONFile(path)
	if err != nil {
		t.Fatal(err)
	}
	packages := data["packages"].([]any)
	if len(packages) != 2 {
		t.Fatalf("packages = %#v, want no duplicate", packages)
	}
}

func setupPiProject(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", filepath.Join(dir, "home"))
	projDir := filepath.Join(dir, "project")
	if err := os.MkdirAll(projDir, 0755); err != nil {
		t.Fatal(err)
	}

	origDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(projDir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(origDir) })
	return projDir
}
