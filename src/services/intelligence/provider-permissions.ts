import type { AiProviderId } from "@/types/domain";

export function providerHostOrigin(provider: AiProviderId): string {
  return provider === "anthropic"
    ? "https://api.anthropic.com/*"
    : "https://api.openai.com/*";
}

export async function requestProviderHostPermission(
  provider: AiProviderId,
): Promise<boolean> {
  const extensionGlobal: { chrome?: typeof chrome } = globalThis;
  if (!extensionGlobal.chrome) return false;
  return extensionGlobal.chrome.permissions.request({
    origins: [providerHostOrigin(provider)],
  });
}
