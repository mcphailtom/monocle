// Package mcp implements the Monocle MCP server, exposing review operations
// as MCP tools and optionally forwarding engine events as channel notifications.
package mcp

import (
	"context"
	"os/signal"
	"syscall"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Options configures the MCP server.
type Options struct {
	// EnableChannels adds the experimental claude/channel capability and
	// subscribes to engine events for push notifications.
	EnableChannels bool
}

// Run creates and runs the MCP server over stdio, blocking until the client
// disconnects or the process receives SIGINT/SIGTERM.
func Run(opts Options) error {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	serverOpts := &mcp.ServerOptions{
		Instructions: toolInstructions,
	}

	server := mcp.NewServer(&mcp.Implementation{
		Name:    "monocle",
		Version: version(),
	}, serverOpts)

	registerTools(server)

	return server.Run(ctx, &mcp.StdioTransport{})
}

// version returns the binary version, falling back to "dev".
func version() string {
	if Version != "" {
		return Version
	}
	return "dev"
}

// Version is set by the main package before calling Run.
var Version string

const toolInstructions = `Use the review_status tool to check if feedback is pending.
Use the get_feedback tool to retrieve review feedback.
Use the send_artifact tool to send content for review.
Use the add_files tool to add files to the review.`
