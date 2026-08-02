import type { KeyMode } from "@/types/domain";

const SESSION_KEY = "openaiApiKeySession";
const LOCAL_KEY = "openaiApiKeyRemembered";
const KEY_MODE = "openaiKeyMode";

function isPlausibleKey(key: string): boolean {
  return /^sk-[A-Za-z0-9_-]{12,}$/.test(key.trim());
}

export function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 10) return "••••••••";
  return `${trimmed.slice(0, 3)}••••••••${trimmed.slice(-4)}`;
}

export async function restrictSecretStorage(): Promise<void> {
  await Promise.all([
    chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
    chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }),
  ]);
}

export async function saveKeyFromTrustedOptions(
  rawKey: string,
  mode: KeyMode,
): Promise<string> {
  const key = rawKey.trim();
  if (!isPlausibleKey(key)) {
    throw new Error("The key format is not valid.");
  }
  await restrictSecretStorage();
  if (mode === "session") {
    await Promise.all([
      chrome.storage.session.set({ [SESSION_KEY]: key }),
      chrome.storage.local.remove(LOCAL_KEY),
      chrome.storage.local.set({ [KEY_MODE]: mode }),
    ]);
  } else {
    await Promise.all([
      chrome.storage.local.set({ [LOCAL_KEY]: key, [KEY_MODE]: mode }),
      chrome.storage.session.remove(SESSION_KEY),
    ]);
  }
  return maskKey(key);
}

export async function readKeyInServiceWorker(): Promise<{
  key: string | null;
  mode: KeyMode | null;
}> {
  await restrictSecretStorage();
  const [session, local] = await Promise.all([
    chrome.storage.session.get(SESSION_KEY),
    chrome.storage.local.get([LOCAL_KEY, KEY_MODE]),
  ]);
  if (typeof session[SESSION_KEY] === "string") {
    return { key: session[SESSION_KEY], mode: "session" };
  }
  if (typeof local[LOCAL_KEY] === "string") {
    return { key: local[LOCAL_KEY], mode: "remembered" };
  }
  return { key: null, mode: null };
}

export async function getKeyStatus(): Promise<{
  available: boolean;
  mode: KeyMode | null;
  masked: string | null;
}> {
  if (!hasChromeStorage()) {
    return { available: false, mode: null, masked: null };
  }
  const { key, mode } = await readKeyInServiceWorker();
  return {
    available: key !== null,
    mode,
    masked: key === null ? null : maskKey(key),
  };
}

export async function removeKeyFromTrustedOptions(): Promise<void> {
  await Promise.all([
    chrome.storage.session.remove(SESSION_KEY),
    chrome.storage.local.remove([LOCAL_KEY, KEY_MODE]),
  ]);
}

function hasChromeStorage(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const storage: unknown = Reflect.get(chromeValue, "storage");
  return Boolean(storage && typeof storage === "object");
}
