export type AppErrorCode =
  | "MISSING_KEY"
  | "INVALID_KEY"
  | "QUOTA_EXHAUSTED"
  | "OPENAI_RATE_LIMIT"
  | "UNSUPPORTED_MODEL"
  | "UNSUPPORTED_TOOL"
  | "MALFORMED_MODEL_RESPONSE"
  | "OPENAI_TIMEOUT"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_OVERLOADED"
  | "PROVIDER_TIMEOUT"
  | "SLEEPER_UNAVAILABLE"
  | "SLEEPER_RATE_LIMIT"
  | "USER_NOT_FOUND"
  | "LEAGUE_NOT_FOUND"
  | "DRAFT_NOT_FOUND"
  | "ROSTER_NOT_FOUND"
  | "INVALID_IMPORT"
  | "INDEXED_DB_FAILURE"
  | "CACHE_MIGRATION_FAILURE"
  | "OFFLINE"
  | "PERMISSION_FAILURE"
  | "UNSUPPORTED_BROWSER"
  | "INVALID_MESSAGE"
  | "STALE_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "CANCELLED"
  | "UNKNOWN";

type AppErrorOptions = {
  code: AppErrorCode;
  message: string;
  safeDetail: string;
  suggestedAction: string;
  retryable: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly safeDetail: string;
  readonly suggestedAction: string;
  readonly retryable: boolean;
  readonly diagnosticCode: string;
  override readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.safeDetail = options.safeDetail;
    this.suggestedAction = options.suggestedAction;
    this.retryable = options.retryable;
    this.cause = options.cause;
    this.diagnosticCode = `NS-${options.code}`;
  }

  toSafeObject() {
    return {
      code: this.code,
      message: this.message,
      safeDetail: this.safeDetail,
      suggestedAction: this.suggestedAction,
      retryable: this.retryable,
      diagnosticCode: this.diagnosticCode,
    };
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AppError({
      code: "CANCELLED",
      message: "The request was cancelled.",
      safeDetail: "The operation ended before completion.",
      suggestedAction: "Retry when you are ready.",
      retryable: true,
      cause: error,
    });
  }
  return new AppError({
    code: "UNKNOWN",
    message: "Something went wrong.",
    safeDetail: "The operation could not be completed safely.",
    suggestedAction:
      "Retry. If the issue continues, export redacted diagnostics.",
    retryable: true,
    cause: error,
  });
}
