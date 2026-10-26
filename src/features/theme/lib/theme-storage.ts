import type { Theme } from "../types";

// Keep in sync with the pre-paint script in index.html.
export const THEME_STORAGE_KEY = "blockbuster-theme";

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage can be unavailable; fall back to the system theme.
  }
  return "system";
}

export function writeStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures; the theme still applies for this session.
  }
}
