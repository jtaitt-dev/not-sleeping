const HTTPS_PROTOCOL = "https:";
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function validateExternalHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== HTTPS_PROTOCOL ||
      BLOCKED_HOSTS.has(url.hostname) ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function safeOpenExternal(url: string): boolean {
  const validated = validateExternalHttpsUrl(url);
  if (!validated) return false;
  window.open(validated, "_blank", "noopener,noreferrer");
  return true;
}
