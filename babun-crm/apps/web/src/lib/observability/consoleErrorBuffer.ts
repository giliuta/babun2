// STORY-060 §F3.5 — ring buffer wrapper around `console.error`.
//
// The bug-report modal attaches the last 20 captured errors to the
// payload so the dispatcher's complaint arrives with breadcrumbs.
// Install once at the dashboard layout level.

const RING_SIZE = 20;
const ENTRY_CAP = 2000;

let installed = false;
const ring: string[] = [];

function safeSerialize(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? "\n" + arg.stack : ""}`;
  }
  if (typeof arg === "string") return arg;
  try {
    const seen = new WeakSet<object>();
    const replacer = (_key: string, value: unknown): unknown => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value as object)) return "[Circular]";
        seen.add(value as object);
      }
      return value;
    };
    return JSON.stringify(arg, replacer);
  } catch {
    return String(arg);
  }
}

export function installConsoleErrorBuffer(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const stamp = new Date().toISOString();
      const text =
        `${stamp} ${args.map(safeSerialize).join(" ")}`.slice(0, ENTRY_CAP);
      ring.push(text);
      while (ring.length > RING_SIZE) ring.shift();
    } catch {
      // never let our buffer break the original sink
    }
    original(...args);
  };
}

export function getRecentConsoleErrors(): string[] {
  return ring.slice();
}

// Legacy alias — earlier stub exported this name; keep it so any
// pre-existing callers don't break during the refactor.
export function getConsoleErrorBuffer(): string[] {
  return getRecentConsoleErrors();
}
