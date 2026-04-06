package desktop

import (
	"context"
	"strconv"

	"github.com/josephschmitt/monocle/internal/core"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// bridgeEngineEvents subscribes to engine events and emits them as Wails events.
// The frontend listens via runtime.EventsOn("event_name", callback).
func bridgeEngineEvents(engine core.EngineAPI, ctx context.Context) {
	engine.On(core.EventFileChanged, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "file_changed", map[string]string{
			"path": e.Path,
		})
	})

	engine.On(core.EventFeedbackStatusChanged, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "feedback_status_changed", map[string]string{
			"status": e.Status,
		})
	})

	engine.On(core.EventContentItemAdded, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "content_item_added", map[string]string{
			"id": e.ItemID,
		})
	})

	engine.On(core.EventAdditionalFileAdded, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "additional_file_added", map[string]string{
			"path": e.Path,
		})
	})

	engine.On(core.EventPauseChanged, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "pause_changed", map[string]string{
			"status": e.Status,
		})
	})

	engine.On(core.EventConnectionChanged, func(e core.EventPayload) {
		// Parse subscriber count from status (matches TUI's app.go logic).
		count := 0
		mode := ""
		if e.Status == "queue" {
			mode = "queue"
		} else {
			count, _ = strconv.Atoi(e.Status)
		}
		wailsRuntime.EventsEmit(ctx, "connection_changed", map[string]interface{}{
			"count":   count,
			"mode":    mode,
			"message": e.Message,
		})
	})

	engine.On(core.EventFeedbackPickedUp, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "feedback_picked_up", nil)
	})

	engine.On(core.EventWaitStatusChanged, func(e core.EventPayload) {
		wailsRuntime.EventsEmit(ctx, "wait_status_changed", map[string]string{
			"status": e.Status,
		})
	})
}
