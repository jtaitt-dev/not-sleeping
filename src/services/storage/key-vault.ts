import type { AiProviderId, KeyMode, KeyStatus } from "@/types/domain";

const KEY_STORAGE: Record<
  AiProviderId,
  { session: string; local: string; mode: string }
> = {
  openai: {
    session: "openaiApiKeySession",
    local: "openaiApiKeyRemembered",
    mode: "openaiKeyMode",
  },
  anthropic: {
    session: "anthropicApiKeySession",
    local: "anthropicApiKeyRemembered",
    mode: "anthropicKeyMode",
  },
};

function isPlausibleKey(provider: AiProviderId, key: string): boolean {
  const trimmed = key.trim();
  if (provider === "anthropic") {
    return /^sk-ant-[A-Za-z0-9_-]{12,}$/.test(trimmed);
  }
  return /^sk-[A-Za-z0-9_-]{12,}$/.test(trimmed);
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
  return saveProviderKeyFromTrustedOptions("openai", rawKey, mode);
}

export async function saveProviderKeyFromTrustedOptions(
  provider: AiProviderId,
  rawKey: string,
  mode: KeyMode,
): Promise<string> {
  const key = rawKey.trim();
  if (!isPlausibleKey(provider, key)) {
    throw new Error("The key format is not valid.");
  }
  const storage = KEY_STORAGE[provider];
  await restrictSecretStorage();
  if (mode === "session") {
    await Promise.all([
      chrome.storage.session.set({ [storage.session]: key }),
      chrome.storage.local.remove(storage.local),
      chrome.storage.local.set({ [storage.mode]: mode }),
    ]);
  } else {
    await Promise.all([
      chrome.storage.local.set({ [storage.local]: key, [storage.mode]: mode }),
      chrome.storage.session.remove(storage.session),
    ]);
  }
  return maskKey(key);
}

export async function readKeyInServiceWorker(): Promise<{
  key: string | null;
  mode: KeyMode | null;
}> {
  return readProviderKeyInServiceWorker("openai");
}

export async function readProviderKeyInServiceWorker(
  provider: AiProviderId,
): Promise<{ key: string | null; mode: KeyMode | null }> {
  const storage = KEY_STORAGE[provider];
  await restrictSecretStorage();
  const [session, local] = await Promise.all([
    chrome.storage.session.get(storage.session),
    chrome.storage.local.get([storage.local, storage.mode]),
  ]);
  const sessionKey = session[storage.session];
  const localKey = local[storage.local];
  if (typeof sessionKey === "string") {
    return { key: sessionKey, mode: "session" };
  }
  if (typeof localKey === "string") {
    return { key: localKey, mode: "remembered" };
  }
  return { key: null, mode: null };
}

export async function getKeyStatus(): Promise<{
  available: boolean;
  mode: KeyMode | null;
  masked: string | null;
}> {
  return getProviderKeyStatus("openai");
}

export async function getProviderKeyStatus(
  provider: AiProviderId,
): Promise<KeyStatus> {
  if (!hasChromeStorage()) {
    return { available: false, mode: null, masked: null };
  }
  const { key, mode } = await readProviderKeyInServiceWorker(provider);
  return {
    available: key !== null,
    mode,
    masked: key === null ? null : maskKey(key),
  };
}

export async function getAllProviderKeyStatuses(): Promise<
  Record<AiProviderId, KeyStatus>
> {
  const [openai, anthropic] = await Promise.all([
    getProviderKeyStatus("openai"),
    getProviderKeyStatus("anthropic"),
  ]);
  return { openai, anthropic };
}

export async function removeKeyFromTrustedOptions(): Promise<void> {
  return removeProviderKeyFromTrustedOptions("openai");
}

export async function removeProviderKeyFromTrustedOptions(
  provider: AiProviderId,
): Promise<void> {
  const storage = KEY_STORAGE[provider];
  await Promise.all([
    chrome.storage.session.remove(storage.session),
    chrome.storage.local.remove([storage.local, storage.mode]),
  ]);
}

function hasChromeStorage(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const storage: unknown = Reflect.get(chromeValue, "storage");
  return Boolean(storage && typeof storage === "object");
}
