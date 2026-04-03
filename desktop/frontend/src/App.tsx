import { useEffect, useState } from "react";

// Wails bindings will be generated at desktop/frontend/wailsjs/
// For now, use window.go for type-safe access once bindings are generated
declare global {
  interface Window {
    go: {
      desktop: {
        App: {
          GetSession(): Promise<unknown>;
          GetChangedFiles(): Promise<unknown[]>;
          GetContentItems(): Promise<unknown[]>;
          GetAdditionalFiles(): Promise<unknown[]>;
        };
      };
    };
    runtime: {
      EventsOn(eventName: string, callback: (...args: unknown[]) => void): () => void;
    };
  }
}

function App() {
  const [connected, setConnected] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    // Test the Go bindings on mount
    async function init() {
      try {
        const session = await window.go.desktop.App.GetSession();
        if (session) {
          setConnected(true);
          const files = await window.go.desktop.App.GetChangedFiles();
          setFileCount(files?.length ?? 0);
        }
      } catch {
        // Bindings not available yet (dev mode without wails)
        console.log("Wails bindings not available");
      }
    }
    init();
  }, []);

  return (
    <div className="flex h-full flex-col bg-base text-text">
      {/* Title bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-sm font-bold text-title">Monocle</h1>
        <div className="flex items-center gap-2 text-xs text-muted">
          {connected ? (
            <span className="text-status-added">Connected</span>
          ) : (
            <span>Initializing...</span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border overflow-y-auto p-2">
          <div className="text-xs font-bold text-subtext uppercase tracking-wider mb-2">
            Changed Files
          </div>
          {connected ? (
            <div className="text-sm text-muted">
              {fileCount} file{fileCount !== 1 ? "s" : ""} changed
            </div>
          ) : (
            <div className="text-sm text-muted">Loading...</div>
          )}
        </aside>

        {/* Main pane */}
        <main className="flex-1 overflow-auto p-4">
          <div className="flex h-full items-center justify-center text-muted">
            <div className="text-center">
              <p className="text-lg">Monocle Desktop</p>
              <p className="text-sm mt-2">Select a file to view its diff</p>
            </div>
          </div>
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between border-t border-border bg-mantle px-4 py-1 text-xs text-muted">
        <span>Press ? for help</span>
        <span>{fileCount} files</span>
      </footer>
    </div>
  );
}

export default App;
