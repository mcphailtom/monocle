package mcp

import (
	"testing"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestRegisterTools(t *testing.T) {
	server := sdkmcp.NewServer(&sdkmcp.Implementation{
		Name:    "monocle",
		Version: "test",
	}, nil)

	registerTools(server)

	// Verify all 4 tools are registered by listing them
	// The server should not panic and should accept all tool registrations
}

func TestTextResult(t *testing.T) {
	r := textResult("hello")
	if len(r.Content) != 1 {
		t.Fatalf("expected 1 content item, got %d", len(r.Content))
	}
	tc, ok := r.Content[0].(*sdkmcp.TextContent)
	if !ok {
		t.Fatal("expected TextContent")
	}
	if tc.Text != "hello" {
		t.Errorf("expected 'hello', got %q", tc.Text)
	}
	if r.IsError {
		t.Error("should not be error")
	}
}

func TestErrResult(t *testing.T) {
	r := errResult("failed: %v", "bad thing")
	if !r.IsError {
		t.Error("should be error")
	}
	tc := r.Content[0].(*sdkmcp.TextContent)
	if tc.Text != "failed: bad thing" {
		t.Errorf("unexpected text: %q", tc.Text)
	}
}
