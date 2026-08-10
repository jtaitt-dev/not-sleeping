import type { SafeRuntimeError } from "@/services/messaging/runtime-client";

export type DraftSafeError = {
  title: string;
  detail: string;
  action: string;
  retryable: boolean;
  diagnosticCode: string;
};

export function translateDraftError(error: SafeRuntimeError): DraftSafeError {
  const fallback = {
    title: "Draft data needs a refresh",
    detail:
      "Your last valid local recommendation is still available when possible.",
    action: "Retry the read-only refresh.",
  };
  const known: Record<
    string,
    Omit<DraftSafeError, "retryable" | "diagnosticCode">
  > = {
    OFFLINE: {
      title: "You are offline",
      detail: "The Draft Copilot is using its last verified local data.",
      action:
        "Reconnect to update Sleeper data; local analysis remains available.",
    },
    SLEEPER_RATE_LIMIT: {
      title: "Sleeper refresh is cooling down",
      detail: "Recent draft data stays visible while requests are limited.",
      action: "Wait a moment and retry.",
    },
    SLEEPER_UNAVAILABLE: {
      title: "Sleeper is temporarily unavailable",
      detail:
        "The Draft Copilot kept the last safe board instead of clearing it.",
      action: "Retry when Sleeper is reachable.",
    },
    MISSING_KEY: {
      title: "AI analysis is off",
      detail: "The deterministic Draft Copilot remains fully available.",
      action: "Add a provider key in Settings only if you want AI context.",
    },
    INVALID_KEY: {
      title: "AI could not authenticate",
      detail:
        "No provider response was applied; the local recommendation is unchanged.",
      action: "Update the provider key in Settings.",
    },
    QUOTA_EXHAUSTED: {
      title: "AI usage limit reached",
      detail: "The deterministic recommendation remains active.",
      action: "Use local analysis or review provider billing later.",
    },
    OPENAI_RATE_LIMIT: {
      title: "AI analysis is cooling down",
      detail: "The deterministic recommendation remains active.",
      action: "Retry AI analysis in a moment.",
    },
    PROVIDER_RATE_LIMIT: {
      title: "AI analysis is cooling down",
      detail: "The deterministic recommendation remains active.",
      action: "Retry AI analysis in a moment.",
    },
    MALFORMED_MODEL_RESPONSE: {
      title: "AI response was not usable",
      detail:
        "The response was discarded before it could affect the recommendation.",
      action: "Keep the local result or retry AI analysis.",
    },
  };
  const mapped = known[error.code] ?? fallback;
  return {
    ...mapped,
    retryable: error.retryable,
    diagnosticCode: safeDiagnostic(error.diagnosticCode),
  };
}

function safeDiagnostic(value: string): string {
  return /^NS-[A-Z0-9_-]{2,40}$/.test(value) ? value : "NS-UNKNOWN";
}
