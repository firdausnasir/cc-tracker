"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "device";

const STORAGE_KEY = "theme";
const CYCLE: readonly Theme[] = ["light", "dark", "device"];

type ThemeContextValue = {
  theme: Theme;
  cycle: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

// localStorage["theme"] holds the user's *choice* (light | dark | device) and
// is the single source of truth; the `.dark` class on <html> is a derived
// projection of it, set before paint by the no-flash script in the root layout.
// "device" (also the absent/unknown default) resolves against the OS preference
// at apply time. We derive React state from localStorage via useSyncExternalStore
// — no setState-in-effect, server/client stay consistent.
const DARK_QUERY = "(prefers-color-scheme: dark)";

// storage events don't fire in the originating tab, so the toggle dispatches
// this to notify same-tab subscribers.
const CHANGE_EVENT = "cc-theme-change";

function prefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

function resolveDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "device" && prefersDark());
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "device") {
      return stored;
    }
  } catch {
    // Private mode / storage disabled — fall through to the default.
  }

  return "device";
}

function getServerSnapshot(): Theme {
  return "device";
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  // When the OS preference flips while in device mode, re-project onto `.dark`
  // and re-render. No-op for explicit light/dark choices.
  const onMedia = () => {
    applyTheme(getSnapshot());
    onChange();
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onMedia);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onMedia);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const cycle = React.useCallback(() => {
    const next = CYCLE[(CYCLE.indexOf(getSnapshot()) + 1) % CYCLE.length];
    applyTheme(next);

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the choice just won't persist.
    }

    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = React.useMemo(() => ({ theme, cycle }), [theme, cycle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);

  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return ctx;
}
