import {
  sendRuntimeMessage,
  type RuntimeMessageInput,
} from "@/services/messaging/protocol";

export type SafeRuntimeError = {
  code: string;
  message: string;
  safeDetail: string;
  suggestedAction: string;
  retryable: boolean;
  diagnosticCode: string;
};

export class RuntimeRequestError extends Error {
  readonly detail: SafeRuntimeError;

  constructor(detail: SafeRuntimeError) {
    super(detail.message);
    this.name = "RuntimeRequestError";
    this.detail = detail;
  }
}

export async function requestRuntime<T>(
  input: RuntimeMessageInput,
): Promise<T> {
  const response = await sendRuntimeMessage(input);
  if (!response || typeof response !== "object") {
    throw unavailableError();
  }
  const record = response as Record<string, unknown>;
  if (record["ok"] === true) return record["data"] as T;
  const error = record["error"];
  if (error && typeof error === "object") {
    const detail = error as Partial<SafeRuntimeError>;
    throw new RuntimeRequestError({
      code: detail.code ?? "UNKNOWN",
      message: detail.message ?? "The extension request failed.",
      safeDetail:
        detail.safeDetail ?? "No additional safe diagnostic was returned.",
      suggestedAction: detail.suggestedAction ?? "Retry the action.",
      retryable: detail.retryable ?? true,
      diagnosticCode: detail.diagnosticCode ?? "NS-UNKNOWN",
    });
  }
  throw unavailableError();
}

export function safeRuntimeError(error: unknown): SafeRuntimeError {
  if (error instanceof RuntimeRequestError) return error.detail;
  return {
    code: "UNKNOWN",
    message: "The request could not be completed.",
    safeDetail:
      "The extension kept internal provider and validation details out of the draft screen.",
    suggestedAction: "Retry. If it continues, export redacted diagnostics.",
    retryable: true,
    diagnosticCode: "NS-UNKNOWN",
  };
}

function unavailableError(): RuntimeRequestError {
  return new RuntimeRequestError({
    code: "UNKNOWN",
    message: "The extension service worker did not return a valid response.",
    safeDetail: "The runtime response envelope was missing or malformed.",
    suggestedAction: "Reload the extension and retry.",
    retryable: true,
    diagnosticCode: "NS-UNKNOWN",
  });
}
