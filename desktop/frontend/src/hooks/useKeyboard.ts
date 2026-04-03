import { useEffect, useRef } from "react";

type KeyHandler = (e: KeyboardEvent) => void;

interface KeyBinding {
  key: string;
  handler: KeyHandler;
  /** Only fire when this condition is true */
  when?: () => boolean;
}

/**
 * Register keyboard shortcuts. Bindings are checked in order;
 * the first matching binding wins and stops propagation.
 */
export function useKeyboard(bindings: KeyBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't capture keys when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      for (const binding of bindingsRef.current) {
        if (binding.when && !binding.when()) continue;
        if (matchKey(e, binding.key)) {
          e.preventDefault();
          e.stopPropagation();
          binding.handler(e);
          return;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function matchKey(e: KeyboardEvent, pattern: string): boolean {
  const parts = pattern.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const needCtrl = parts.includes("ctrl");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");

  if (needCtrl !== e.ctrlKey) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;

  // Handle special key names
  switch (key) {
    case "escape":
    case "esc":
      return e.key === "Escape";
    case "enter":
    case "return":
      return e.key === "Enter";
    case "tab":
      return e.key === "Tab";
    case "backspace":
      return e.key === "Backspace";
    case "space":
      return e.key === " ";
    case "up":
      return e.key === "ArrowUp";
    case "down":
      return e.key === "ArrowDown";
    case "left":
      return e.key === "ArrowLeft";
    case "right":
      return e.key === "ArrowRight";
    default:
      return e.key.toLowerCase() === key || e.key === key;
  }
}

