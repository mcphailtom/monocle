package desktop

import (
	"context"
	"embed"

	wails "github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

// Run starts the Wails desktop application.
// Engine initialization happens in App.startup (OnStartup callback),
// not here — Wails runs the binary during binding generation and we
// must not start real services in main().
func Run() error {
	app := &App{}

	// Native menu bar
	appMenu := menu.NewMenu()
	appMenu.Append(menu.AppMenu()) // macOS standard app menu (About, Preferences, Quit, etc.)

	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("Open Project...", keys.CmdOrCtrl("o"), func(_ *menu.CallbackData) {
		go app.openProjectFromMenu()
	})

	appMenu.Append(menu.EditMenu()) // Standard Edit menu (Undo, Cut, Copy, Paste, etc.)

	return wails.Run(&options.App{
		Title:    "Monocle",
		Width:    1280,
		Height:   800,
		MinWidth: 800,
		MinHeight: 600,
		Menu:     appMenu,
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 46, A: 1},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Mac: &mac.Options{
			TitleBar:   mac.TitleBarHiddenInset(),
			Appearance: mac.NSAppearanceNameDarkAqua,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		OnDomReady: func(_ context.Context) {
			// Align traffic lights vertically with the 52px toolbar (center = 26px).
			configureTrafficLightPosition(26)
		},
		Bind: []interface{}{
			app,
		},
	})
}
