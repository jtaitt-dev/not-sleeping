import { AppError } from "@/services/errors/app-error";

const SLEEPER_PUBLIC_API_ORIGIN = "https://api.sleeper.app";

export function sleeperReadOnlyRequest(url: string): RequestInit {
  const parsed = new URL(url);
  if (parsed.origin !== SLEEPER_PUBLIC_API_ORIGIN) {
    throw readOnlyBoundaryError(
      "The request target is not Sleeper's public API.",
    );
  }
  if (
    !parsed.pathname.startsWith("/v1/") &&
    !parsed.pathname.startsWith("/projections/")
  ) {
    throw readOnlyBoundaryError(
      "The request path is outside the public read-only API.",
    );
  }
  return {
    method: "GET",
    credentials: "omit",
    redirect: "error",
    headers: { Accept: "application/json" },
  };
}

export function assertSleeperRequestIsReadOnly(
  url: string,
  init: RequestInit,
): void {
  sleeperReadOnlyRequest(url);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" || init.body !== undefined) {
    throw readOnlyBoundaryError(
      "Not Sleeping blocks every Sleeper mutation and request body.",
    );
  }
  if (init.credentials && init.credentials !== "omit") {
    throw readOnlyBoundaryError(
      "Sleeper requests may not include browser-session credentials.",
    );
  }
}

function readOnlyBoundaryError(detail: string): AppError {
  return new AppError({
    code: "PERMISSION_FAILURE",
    message: "A non-read-only Sleeper request was blocked.",
    safeDetail: detail,
    suggestedAction: "Use the official public Sleeper GET API only.",
    retryable: false,
  });
}
