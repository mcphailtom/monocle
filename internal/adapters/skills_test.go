package adapters

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// setupTestSkills populates a temp directory with stub SKILL.md files and sets
// SkillsSourceOverride so InstallSkills reads from there instead of downloading.
func setupTestSkills(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	for _, name := range SkillNames {
		skillDir := filepath.Join(dir, name)
		os.MkdirAll(skillDir, 0755)
		os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("# "+name+"\nTest skill content.\n"), 0644)
	}
	SkillsSourceOverride = dir
	t.Cleanup(func() { SkillsSourceOverride = "" })
}

func TestInstallSkills(t *testing.T) {
	setupTestSkills(t)
	dest := t.TempDir()

	if err := InstallSkills(dest); err != nil {
		t.Fatalf("InstallSkills: %v", err)
	}

	for _, name := range SkillNames {
		path := filepath.Join(dest, name, "SKILL.md")
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("skill %s not installed: %v", name, err)
		}
		if len(data) == 0 {
			t.Fatalf("skill %s is empty", name)
		}
	}
}

func TestRemoveSkills(t *testing.T) {
	setupTestSkills(t)
	dest := t.TempDir()

	if err := InstallSkills(dest); err != nil {
		t.Fatalf("InstallSkills: %v", err)
	}

	RemoveSkills(dest)

	for _, name := range SkillNames {
		path := filepath.Join(dest, name, "SKILL.md")
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("skill %s should have been removed", name)
		}
	}
}

func TestExtractSkillsTarball(t *testing.T) {
	// Create a tarball in memory
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	files := map[string]string{
		"skill-a/SKILL.md": "# Skill A\n",
		"skill-b/SKILL.md": "# Skill B\n",
	}
	for name, content := range files {
		hdr := &tar.Header{
			Name: name,
			Mode: 0644,
			Size: int64(len(content)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	tw.Close()
	gz.Close()

	dest := t.TempDir()
	if err := extractSkillsTarball(buf.Bytes(), dest); err != nil {
		t.Fatalf("extractSkillsTarball: %v", err)
	}

	for name, expected := range files {
		data, err := os.ReadFile(filepath.Join(dest, name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		if string(data) != expected {
			t.Fatalf("%s: got %q, want %q", name, data, expected)
		}
	}
}

func TestExtractSkillsTarball_PathTraversal(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	hdr := &tar.Header{
		Name: "../../../etc/evil",
		Mode: 0644,
		Size: 5,
	}
	tw.WriteHeader(hdr)
	tw.Write([]byte("evil\n"))
	tw.Close()
	gz.Close()

	dest := t.TempDir()
	if err := extractSkillsTarball(buf.Bytes(), dest); err != nil {
		t.Fatalf("extractSkillsTarball should not error on traversal entries: %v", err)
	}

	// The evil file should NOT have been created
	if _, err := os.Stat(filepath.Join(dest, "..", "..", "..", "etc", "evil")); !os.IsNotExist(err) {
		t.Fatal("path traversal entry should have been skipped")
	}
}

func TestEnsureSkillsCached(t *testing.T) {
	// Create a test tarball
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	for _, name := range SkillNames {
		content := "# " + name + "\nTest.\n"
		hdr := &tar.Header{
			Name: name + "/SKILL.md",
			Mode: 0644,
			Size: int64(len(content)),
		}
		tw.WriteHeader(hdr)
		tw.Write([]byte(content))
	}
	tw.Close()
	gz.Close()

	// Serve it over HTTP
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/gzip")
		w.Write(buf.Bytes())
	}))
	defer server.Close()

	// Override the URL template
	origTemplate := skillsReleaseURLTemplate
	defer func() { skillsReleaseURLTemplate = origTemplate }()
	skillsReleaseURLTemplate = server.URL + "/%s/skills.tar.gz"

	// Use a temp dir for the cache
	origTmp := os.Getenv("TMPDIR")
	tmpDir := t.TempDir()
	os.Setenv("TMPDIR", tmpDir)
	defer os.Setenv("TMPDIR", origTmp)

	dir, err := EnsureSkillsCached("1.0.0")
	if err != nil {
		t.Fatalf("EnsureSkillsCached: %v", err)
	}

	// Verify skills were extracted
	for _, name := range SkillNames {
		path := filepath.Join(dir, name, "SKILL.md")
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("skill %s not cached: %v", name, err)
		}
	}

	// Verify marker exists
	if _, err := os.Stat(filepath.Join(dir, ".complete")); err != nil {
		t.Fatal("completion marker should exist")
	}

	// Second call should use cache (no HTTP request needed)
	server.Close() // close server to prove no request is made
	dir2, err := EnsureSkillsCached("1.0.0")
	if err != nil {
		t.Fatalf("second EnsureSkillsCached should use cache: %v", err)
	}
	if dir != dir2 {
		t.Fatalf("cache dirs should match: %q vs %q", dir, dir2)
	}
}

func TestResolveSkillsSource_DevMode(t *testing.T) {
	origVersion := Version
	Version = "dev"
	defer func() { Version = origVersion }()

	origOverride := SkillsSourceOverride
	SkillsSourceOverride = ""
	defer func() { SkillsSourceOverride = origOverride }()

	// Create a fake skills dir in a temp directory
	dir := t.TempDir()
	skillsDir := filepath.Join(dir, "skills")
	for _, name := range SkillNames {
		os.MkdirAll(filepath.Join(skillsDir, name), 0755)
		os.WriteFile(filepath.Join(skillsDir, name, "SKILL.md"), []byte("# test"), 0644)
	}

	origDir, _ := os.Getwd()
	os.Chdir(dir)
	defer os.Chdir(origDir)

	src, err := resolveSkillsSource()
	if err != nil {
		t.Fatalf("resolveSkillsSource: %v", err)
	}
	if src != "skills" {
		t.Fatalf("expected 'skills', got %q", src)
	}
}

func TestResolveSkillsSource_Override(t *testing.T) {
	dir := t.TempDir()
	SkillsSourceOverride = dir
	defer func() { SkillsSourceOverride = "" }()

	src, err := resolveSkillsSource()
	if err != nil {
		t.Fatalf("resolveSkillsSource: %v", err)
	}
	if src != dir {
		t.Fatalf("expected %q, got %q", dir, src)
	}
}
