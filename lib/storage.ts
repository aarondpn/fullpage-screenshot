import type { ImageFormat } from "./formats";

export interface UserSettings {
  format: ImageFormat;
  quality: number;
  resolution: "full" | "standard";
  autoCapture: boolean;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  width: number;
  height: number;
  fileSize: number;
  format: ImageFormat;
  tileCount: number;
  thumbnailDataUrl: string;
}

export type ThemePreference = "system" | "light" | "dark";

const DEFAULTS: UserSettings = {
  format: "png",
  quality: 0.92,
  resolution: "standard",
  autoCapture: true,
};

const MAX_HISTORY = 50;

export async function getSettings(): Promise<UserSettings> {
  const { settings } = await browser.storage.local.get("settings");
  return settings ? { ...DEFAULTS, ...settings } : { ...DEFAULTS };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await browser.storage.local.set({ settings });
}

export async function getTheme(): Promise<ThemePreference> {
  const { theme } = await browser.storage.local.get("theme");
  return (theme as ThemePreference) || "system";
}

export async function saveTheme(theme: ThemePreference): Promise<void> {
  await browser.storage.local.set({ theme });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const { history } = await browser.storage.local.get("history");
  return (history as HistoryEntry[]) || [];
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  await browser.storage.local.set({ history });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter((e) => e.id !== id);
  await browser.storage.local.set({ history: filtered });
}

export async function clearHistory(): Promise<void> {
  await browser.storage.local.set({ history: [] });
}
