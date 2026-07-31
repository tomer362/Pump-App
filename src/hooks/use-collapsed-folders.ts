"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pump.collapsed-folders";

/* -------------------------------------------------------------------------- *
 * Which folders are collapsed, as an external store.
 *
 * It has to survive navigation and reloads — collapsing a folder you never
 * train from is pointless if it springs open on every visit — which means
 * reading localStorage. Doing that in a `useState` initialiser would make the
 * first client render disagree with the server HTML, and React discards a
 * mismatched subtree: the sections would flash open and re-collapse. The server
 * snapshot is the empty set, which is exactly what the server rendered.
 * -------------------------------------------------------------------------- */

const EMPTY: ReadonlySet<string> = new Set();

let current: ReadonlySet<string> = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === "string"))
      : EMPTY;
  } catch {
    // Private mode, quota, or a value some other version wrote.
    return EMPTY;
  }
}

function write(next: ReadonlySet<string>) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* Non-fatal: the collapse just doesn't outlive the session. */
  }
  for (const l of listeners) l();
}

export function useCollapsedFolders() {
  const subscribe = useCallback((onChange: () => void) => {
    if (!loaded) {
      loaded = true;
      current = read();
    }
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const collapsed = useSyncExternalStore(subscribe, () => current, () => EMPTY);

  const toggle = useCallback((id: string) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    write(next);
  }, []);

  return { collapsed, toggle };
}
