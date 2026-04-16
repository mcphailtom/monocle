import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  /** ms until auto-dismiss. 0 = never. */
  duration?: number;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      const duration = t.duration ?? (t.kind === "error" ? 6000 : 3500);
      setToasts((ts) => [...ts, { id, ...t }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // Animate in by tracking mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const accent =
    toast.kind === "error"
      ? "border-ctp-red/50 bg-ctp-red/10"
      : toast.kind === "success"
        ? "border-ctp-green/50 bg-ctp-green/10"
        : "border-border bg-popover";

  const accentText =
    toast.kind === "error"
      ? "text-ctp-red"
      : toast.kind === "success"
        ? "text-ctp-green"
        : "text-ctp-blue";

  return (
    <div
      className={`pointer-events-auto rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur transition-all duration-200 ${accent} ${
        mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className={`font-semibold mb-0.5 ${accentText}`}>{toast.title}</div>
          )}
          <div className="text-foreground whitespace-pre-wrap break-words">
            {toast.message}
          </div>
        </div>
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground leading-none"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
