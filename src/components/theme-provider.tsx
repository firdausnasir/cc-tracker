"use client";

import * as React from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

// The `.dark` class on <html> is the single source of truth — it's set before
// paint by the no-flash script in the root layout, and we mutate it on toggle.
// Deriving React state from it via useSyncExternalStore (rather than an effect)
// keeps server and client consistent with no setState-in-effect.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = React.useCallback(() => {
    const next: Theme =
      document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");

    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode / storage disabled — the choice just won't persist.
    }
    // The class mutation above triggers the MutationObserver → re-render.
  }, []);

  const value = React.useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);

  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return ctx;
}
