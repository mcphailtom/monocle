package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/alecthomas/kong"
)

// TestCLIParsesWithoutIdleTimeoutFlag guards against a regression where
// ServeCmd.IdleTimeout had a default:"" tag that Kong rejected as an
// invalid duration during CLI setup — breaking every subcommand, not
// just `monocle serve`, because Kong validates all defaults upfront.
func TestCLIParsesWithoutIdleTimeoutFlag(t *testing.T) {
	// Building the parser exercises default-tag validation on every
	// field. If ServeCmd's --idle-timeout regressed to an invalid default
	// this call would fail.
	var cli CLI
	parser, err := kong.New(&cli)
	if err != nil {
		t.Fatalf("kong setup failed (likely a bad default on some flag): %v", err)
	}
	if _, err := parser.Parse([]string{"hooks", "on-stop", "--agent", "claude"}); err != nil {
		t.Fatalf("parse hooks on-stop: %v", err)
	}
}

func TestPidFilePath(t *testing.T) {
	cases := []struct {
		socket string
		want   string
	}{
		{"/tmp/monocle-abc123.sock", "/tmp/monocle-abc123.pid"},
		{"/tmp/custom", "/tmp/custom.pid"},
	}
	for _, tc := range cases {
		got := pidFilePath(tc.socket)
		if got != tc.want {
			t.Errorf("pidFilePath(%q) = %q, want %q", tc.socket, got, tc.want)
		}
	}
}

func TestWriteReadPIDFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.pid")

	if err := writePIDFile(path); err != nil {
		t.Fatalf("write: %v", err)
	}

	pid, err := readPIDFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if pid != os.Getpid() {
		t.Errorf("pid = %d, want %d", pid, os.Getpid())
	}

	removePIDFile(path)
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("pid file still exists after remove: %v", err)
	}
}
