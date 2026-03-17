import { getTheme, saveTheme, type ThemePreference } from "./storage";

export function applyTheme(theme: ThemePreference): void {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  // Sync cache for flash prevention
  try {
    localStorage.setItem("theme-cache", theme);
  } catch {}
}

export async function initTheme(): Promise<ThemePreference> {
  const theme = await getTheme();
  applyTheme(theme);
  return theme;
}

const CYCLE: ThemePreference[] = ["system", "light", "dark"];

export async function cycleTheme(): Promise<ThemePreference> {
  const current = await getTheme();
  const idx = CYCLE.indexOf(current);
  const next = CYCLE[(idx + 1) % CYCLE.length];
  await saveTheme(next);
  applyTheme(next);
  return next;
}

export function getThemeIcon(theme: ThemePreference): string {
  switch (theme) {
    case "light": return "\u2600";
    case "dark": return "\u263E";
    default: return "\u25D1";
  }
}
