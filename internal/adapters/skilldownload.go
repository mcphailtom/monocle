package adapters

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var (
	skillsReleaseURLTemplate = "https://github.com/josephschmitt/monocle/releases/download/v%s/skills.tar.gz"
	skillsLatestURL          = "https://github.com/josephschmitt/monocle/releases/latest/download/skills.tar.gz"
)

// EnsureSkillsCached checks if skills for the given version are cached in the
// temp directory. If not, downloads and extracts the tarball from GitHub releases.
// Returns the cache directory path containing skill subdirectories.
func EnsureSkillsCached(version string) (string, error) {
	dir := skillsCacheDir(version)
	marker := filepath.Join(dir, ".complete")
	if _, err := os.Stat(marker); err == nil {
		return dir, nil
	}

	data, err := downloadSkillsTarball(version)
	if err != nil {
		return "", err
	}

	// Extract to a temp dir, then rename atomically
	tmpDir := dir + ".tmp"
	os.RemoveAll(tmpDir)
	if err := extractSkillsTarball(data, tmpDir); err != nil {
		os.RemoveAll(tmpDir)
		return "", err
	}

	// Write completion marker
	if err := os.WriteFile(filepath.Join(tmpDir, ".complete"), []byte("ok"), 0644); err != nil {
		os.RemoveAll(tmpDir)
		return "", fmt.Errorf("write cache marker: %w", err)
	}

	// Atomic rename
	os.RemoveAll(dir)
	if err := os.Rename(tmpDir, dir); err != nil {
		os.RemoveAll(tmpDir)
		return "", fmt.Errorf("finalize skills cache: %w", err)
	}

	return dir, nil
}

func skillsCacheDir(version string) string {
	return filepath.Join(os.TempDir(), fmt.Sprintf("monocle-skills-v%s", version))
}

func downloadSkillsTarball(version string) ([]byte, error) {
	// Try exact version first, fall back to latest release
	urls := []string{
		fmt.Sprintf(skillsReleaseURLTemplate, version),
		skillsLatestURL,
	}
	for _, u := range urls {
		data, err := fetchURL(u)
		if err == nil {
			return data, nil
		}
	}
	return nil, fmt.Errorf("skills tarball not found for version %s (tried exact and latest release)", version)
}

func fetchURL(url string) ([]byte, error) {
	resp, err := http.Get(url) //nolint:gosec // URL is constructed from constant templates
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func extractSkillsTarball(data []byte, destDir string) error {
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("decompress skills: %w", err)
	}
	defer gz.Close()

	cleanDest := filepath.Clean(destDir) + string(os.PathSeparator)
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read tar: %w", err)
		}

		target := filepath.Join(destDir, filepath.Clean(hdr.Name))
		if !strings.HasPrefix(target, cleanDest) {
			continue // skip entries outside destDir (path traversal protection)
		}

		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return fmt.Errorf("create dir %s: %w", target, err)
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return fmt.Errorf("create parent dir for %s: %w", target, err)
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
			if err != nil {
				return fmt.Errorf("create file %s: %w", target, err)
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return fmt.Errorf("write file %s: %w", target, err)
			}
			f.Close()
		}
	}
	return nil
}
