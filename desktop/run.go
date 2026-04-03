package desktop

import (
	"embed"

	wails "github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// Run starts the Wails desktop application.
// Engine initialization happens in App.startup (OnStartup callback),
// not here — Wails runs the binary during binding generation and we
// must not start real services in main().
func Run() error {
	app := &App{}

	return wails.Run(&options.App{
		Title:    "Monocle",
		Width:    1280,
		Height:   800,
		MinWidth: 800,
		MinHeight: 600,
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 46, A: 1},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})
}
