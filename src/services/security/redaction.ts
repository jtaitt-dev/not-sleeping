const OPENAI_KEY = /\bsk-[A-Za-z0-9_-]{12,}\b/g;
const OPENAI_KEY_TEST = /\bsk-[A-Za-z0-9_-]{12,}\b/;
const AUTHORIZATION =
  /\b(?:authorization|bearer)\s*[:=]?\s+[A-Za-z0-9._~+/-]+/gi;
const IDENTIFIER_IN_URL =
  /https:\/\/(?:api\.)?sleeper\.(?:app|com)\/[^\s?#]*(?:league|draft|roster|user)[^\s?#]*/gi;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "apiKey",
  "openaiKey",
  "username",
  "userId",
  "leagueId",
  "draftId",
  "rosterId",
  "prompt",
  "rawResponse",
  "notes",
]);

export function redactText(value: string): string {
  return value
    .replace(OPENAI_KEY, "[REDACTED_KEY]")
    .replace(AUTHORIZATION, "authorization: [REDACTED]")
    .replace(IDENTIFIER_IN_URL, "[REDACTED_SLEEPER_URL]");
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.has(key) ? "[REDACTED]" : redactValue(entry, depth + 1),
      ]),
    );
  }
  return value;
}

export async function stableAlias(
  namespace: string,
  value: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${namespace}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = [...new Uint8Array(digest).slice(0, 8)];
  return `${namespace}_${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function containsCredential(value: unknown, depth = 0): boolean {
  if (depth > 8) return true;
  if (typeof value === "string") return OPENAI_KEY_TEST.test(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsCredential(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        /^(?:apiKey|openaiKey|authorization|credential|secret)$/i.test(key) ||
        containsCredential(entry, depth + 1),
    );
  }
  return false;
}
