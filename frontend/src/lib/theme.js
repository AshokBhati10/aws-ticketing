// Theme management: Light/Dark mode with localStorage persistence.
// The active theme is a `dark` class on <html>; every color token in
// style.css flips automatically via CSS variables.

export const THEME_STORAGE_KEY = "ticketdesk-theme";

export function getSystemTheme() {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

// Saved preference wins; otherwise respect the OS/system theme.
export function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Storage unavailable (private mode etc.) -- fall through to system.
  }
  return getSystemTheme();
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Call once before the app mounts.
export function initTheme() {
  applyTheme(getTheme());
}

// Flips the theme, persists the choice, returns the new theme.
export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Best effort: the theme still applies for this session.
  }
  applyTheme(next);
  return next;
}
