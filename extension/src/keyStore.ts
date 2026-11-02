// Where the visitor's own Gemini key lives: the extension's local storage on this device only
// (never synced, never sent anywhere except Google). Falls back to localStorage when the page is
// opened outside an extension, e.g. during development.

const KEY = "geminiApiKey";
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/*";

const ext = (globalThis as { chrome?: typeof chrome }).chrome;
const storage = ext?.storage?.local;

export async function loadKey(): Promise<string> {
  if (storage) return ((await storage.get(KEY))[KEY] as string | undefined) ?? "";
  return localStorage.getItem(KEY) ?? "";
}

export async function saveKey(value: string) {
  if (storage) await storage.set({ [KEY]: value });
  else localStorage.setItem(KEY, value);
}

export async function forgetKey() {
  if (storage) await storage.remove(KEY);
  else localStorage.removeItem(KEY);
}

/**
 * Firefox treats Manifest V3 host permissions as opt-in, so ask for access to Gemini when the
 * person saves their key (this must run inside the click). Chrome grants it at install.
 */
export async function ensureGeminiAccess(): Promise<boolean> {
  const permissions = ext?.permissions;
  if (!permissions) return true;
  if (await permissions.contains({ origins: [GEMINI_ORIGIN] })) return true;
  return permissions.request({ origins: [GEMINI_ORIGIN] });
}
