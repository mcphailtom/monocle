package desktop

import (
	"embed"

	"github.com/josephschmitt/monocle/internal/core"
	wails "github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// Run starts the Wails desktop application with the given engine.
func Run(engine core.EngineAPI) error {
	app := NewApp(engine)

	return wails.Run(&options.App{
		Title:  "Monocle",
		Width:  1280,
		Height: 800,
		MinWidth: 800,
		MinHeight: 600,
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 46, A: 1}, // Catppuccin Mocha base
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})
}
