import { z, type ZodType } from "zod";

import {
  anthropicModelCapability,
  supportsRequestedControls,
} from "@/providers/ai/capabilities";
import type {
  AiProvider,
  AiStructuredRequest,
  AiStructuredResult,
} from "@/providers/ai/types";
import { AppError } from "@/services/errors/app-error";
import {
  RequestQueue,
  stableContentHash,
} from "@/services/research/request-queue";
import type { AppSettings, ModelCapability } from "@/types/domain";

const API_ROOT = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_ATTEMPTS = 3;

const modelsResponseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        display_name: z.string().optional(),
        created_at: z.string().optional(),
        type: z.string().optional(),
      })
      .loose(),
  ),
});

const messageResponseSchema = z
  .object({
    id: z.string(),
    model: z.string().optional(),
    content: z.array(
      z
        .object({
          type: z.string(),
          text: z.string().optional(),
        })
        .loose(),
    ),
    usage: z
      .object({
        input_tokens: z.number().int().default(0),
        output_tokens: z.number().int().default(0),
      })
      .optional(),
  })
  .loose();

type AnthropicMessage = z.infer<typeof messageResponseSchema>;

type ProviderOptions = {
  getKey: () => Promise<string | null>;
  getSettings: () => Promise<AppSettings>;
  fetcher?: typeof fetch;
  now?: () => number;
};

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly queue: RequestQueue;
  private modelCache: { fetchedAt: number; models: string[] } | null = null;

  constructor(private readonly options: ProviderOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
    this.queue = new RequestQueue({
      requestsPerMinute: 4,
      concurrency: 1,
      hardConcurrencyCeiling: 4,
      now: this.now,
    });
  }

  async testKey(): Promise<{ ok: true; modelCount: number }> {
    const models = await this.listModels(true);
    return { ok: true, modelCount: models.length };
  }

  async listModels(force = false): Promise<ModelCapability[]> {
    if (
      !force &&
      this.modelCache &&
      this.modelCache.fetchedAt + 60 * 60_000 > this.now()
    ) {
      return this.modelCache.models.map(anthropicModelCapability);
    }
    const key = await this.requireKey();
    const response = await this.fetchWithRetry(
      `${API_ROOT}/models?limit=1000`,
      {
        method: "GET",
        headers: this.headers(key, false),
      },
    );
    const parsed = modelsResponseSchema.parse(await response.json());
    const models = parsed.data
      .map((model) => model.id)
      .filter((id) => id.startsWith("claude-"))
      .toSorted();
    this.modelCache = { fetchedAt: this.now(), models };
    return models.map(anthropicModelCapability);
  }

  async createStructured<T>(
    request: AiStructuredRequest<T>,
  ): Promise<AiStructuredResult<T>> {
    const settings = await this.options.getSettings();
    this.queue.configure({
      requestsPerMinute: settings.aiBudgets.maxRequestsPerMinute,
      concurrency: settings.aiBudgets.maxConcurrency,
    });
    const dedupeKey = stableContentHash({
      provider: this.id,
      model: request.model,
      schema: request.schemaName,
      input: request.input,
      effort: request.reasoningEffort ?? "none",
      thinking: request.thinkingMode ?? "off",
    });
    return this.queue.enqueue(dedupeKey, (signal) =>
      this.runStructured(
        {
          ...request,
          maxOutputTokens:
            request.maxOutputTokens ?? settings.aiDefaults.maxOutputTokens,
          timeoutMs: request.timeoutMs ?? settings.aiDefaults.timeoutMs,
        },
        combineSignals(signal, request.signal),
      ),
    );
  }

  private async runStructured<T>(
    request: AiStructuredRequest<T> & {
      maxOutputTokens: number;
      timeoutMs: number;
    },
    signal: AbortSignal,
  ): Promise<AiStructuredResult<T>> {
    const key = await this.requireKey();
    const capability = anthropicModelCapability(request.model);
    const warnings = supportsRequestedControls(capability, {
      webSearch: request.useWebSearch,
      reasoningEffort: request.reasoningEffort,
      thinkingMode: request.thinkingMode,
    });
    const response = await this.requestMessage(request, key, signal, false);
    try {
      return parseStructuredResponse(response, request.schema, warnings);
    } catch (error) {
      if (!(error instanceof AppError) || signal.aborted) throw error;
      const repaired = await this.requestMessage(
        {
          ...request,
          system: `${request.system} The prior answer failed the required schema. Repair structure only; do not add unsupported facts.`,
        },
        key,
        signal,
        true,
      );
      return parseStructuredResponse(repaired, request.schema, warnings);
    }
  }

  private async requestMessage<T>(
    request: AiStructuredRequest<T> & {
      maxOutputTokens: number;
      timeoutMs: number;
    },
    key: string,
    parentSignal: AbortSignal,
    repair: boolean,
  ): Promise<AnthropicMessage> {
    const timeout = AbortSignal.timeout(request.timeoutMs);
    const signal = combineSignals(parentSignal, timeout);
    const capability = anthropicModelCapability(request.model);
    const effort = capability.reasoningEfforts?.includes(
      request.reasoningEffort ?? "none",
    )
      ? request.reasoningEffort
      : undefined;
    const thinking = supportedThinking(request, capability);
    const jsonSchema = z.toJSONSchema(request.schema, {
      target: "draft-2020-12",
      unrepresentable: "any",
    });
    const body = {
      model: request.model,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: [
        {
          role: "user",
          content: repair
            ? `${request.input}\nReturn a corrected object matching the schema.`
            : request.input,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: jsonSchema,
        },
        ...(effort && effort !== "none" ? { effort } : {}),
      },
      ...(thinking ? { thinking } : {}),
    };
    try {
      const response = await this.fetchWithRetry(`${API_ROOT}/messages`, {
        method: "POST",
        headers: this.headers(key, true),
        body: JSON.stringify(body),
        signal,
      });
      return messageResponseSchema.parse(await response.json());
    } catch (error) {
      if (parentSignal.aborted) throw cancelledError(error);
      throw error;
    }
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.fetcher.call(globalThis, url, init);
        if (response.ok) return response;
        const error = await parseError(response);
        const mapped = mapAnthropicError(response.status, error.type);
        if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS) {
          throw mapped;
        }
        await wait(
          parseRetryAfter(response.headers.get("retry-after")) ??
            backoff(attempt),
          init.signal,
        );
      } catch (error) {
        lastError = error;
        if (
          error instanceof AppError ||
          isAbort(error) ||
          attempt === MAX_ATTEMPTS
        ) {
          throw normalizeNetworkError(error);
        }
        await wait(backoff(attempt), init.signal);
      }
    }
    throw normalizeNetworkError(lastError);
  }

  private headers(key: string, json: boolean): HeadersInit {
    return {
      Accept: "application/json",
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  private async requireKey(): Promise<string> {
    const key = await this.options.getKey();
    if (key) return key;
    throw new AppError({
      code: "MISSING_KEY",
      message: "Anthropic intelligence is unavailable.",
      safeDetail: "No Anthropic key is configured.",
      suggestedAction: "Add a session-only Anthropic key in Settings.",
      retryable: false,
    });
  }
}

function supportedThinking<T>(
  request: AiStructuredRequest<T> & { maxOutputTokens: number },
  capability: ModelCapability,
): Record<string, unknown> | undefined {
  const requested = request.thinkingMode ?? "off";
  if (requested === "off") return undefined;
  const supported = capability.thinkingModes ?? [];
  // A stored preference may name a mode this model dropped. Substitute the
  // model's own thinking mode rather than sending a rejected parameter: newer
  // models answer `budget_tokens` with HTTP 400.
  const mode = supported.includes(requested)
    ? requested
    : supported.includes("adaptive")
      ? "adaptive"
      : undefined;
  if (mode === undefined) return undefined;
  if (mode === "adaptive") return { type: "adaptive" };
  if (request.maxOutputTokens <= 1_024) return undefined;
  return {
    type: "enabled",
    budget_tokens: Math.min(4_096, request.maxOutputTokens - 1),
  };
}

function parseStructuredResponse<T>(
  response: AnthropicMessage,
  schema: ZodType<T>,
  warnings: string[],
): AiStructuredResult<T> {
  const text = response.content.find(
    (part) => part.type === "text" && typeof part.text === "string",
  )?.text;
  if (!text) throw malformedResponse("The response contained no text.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw malformedResponse("The response was not valid JSON.", error);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw malformedResponse(
      "The response did not match the required schema.",
      parsed.error,
    );
  }
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  return {
    data: parsed.data,
    responseId: response.id,
    ...(response.model ? { resolvedModel: response.model } : {}),
    provider: "anthropic",
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    citationUrls: [],
    warnings,
  };
}

export function parseAnthropicEventStream(text: string): unknown[] {
  const events: unknown[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // Ignore malformed or partial SSE frames; callers can continue buffering.
    }
  }
  return events;
}

async function parseError(
  response: Response,
): Promise<{ type?: string; message: string }> {
  try {
    const parsed = z
      .object({
        error: z.object({ type: z.string().optional(), message: z.string() }),
      })
      .safeParse(await response.json());
    return parsed.success
      ? parsed.data.error
      : { message: `Anthropic returned HTTP ${response.status}.` };
  } catch {
    return { message: `Anthropic returned HTTP ${response.status}.` };
  }
}

function mapAnthropicError(status: number, type?: string): AppError {
  if (status === 401) {
    return new AppError({
      code: "INVALID_KEY",
      message: "The Anthropic key was rejected.",
      safeDetail: "Anthropic returned an authentication failure.",
      suggestedAction: "Replace the key with a valid dedicated key.",
      retryable: false,
    });
  }
  if (status === 403) {
    return new AppError({
      code: "PERMISSION_FAILURE",
      message: "The Anthropic account cannot use this feature.",
      safeDetail: "Anthropic returned a permission failure.",
      suggestedAction: "Choose an available model or review account access.",
      retryable: false,
    });
  }
  if (status === 404 || type === "not_found_error") {
    return new AppError({
      code: "UNSUPPORTED_MODEL",
      message: "The selected Anthropic model is unavailable.",
      safeDetail: "Anthropic could not resolve the selected model.",
      suggestedAction: "Refresh models or select another model.",
      retryable: false,
    });
  }
  if (status === 429) {
    return new AppError({
      code: "PROVIDER_RATE_LIMIT",
      message: "Anthropic is receiving too many requests.",
      safeDetail: "The provider returned HTTP 429.",
      suggestedAction: "Wait for the retry or reduce request limits.",
      retryable: true,
    });
  }
  if (status === 529) {
    return new AppError({
      code: "PROVIDER_OVERLOADED",
      message: "Anthropic is temporarily overloaded.",
      safeDetail: "The provider returned HTTP 529.",
      suggestedAction: "Use the deterministic result and retry later.",
      retryable: true,
    });
  }
  return new AppError({
    code: "UNKNOWN",
    message: "Anthropic could not complete the request.",
    safeDetail: `The provider returned HTTP ${status}.`,
    suggestedAction:
      status >= 500 ? "Retry later." : "Review request settings.",
    retryable: status >= 500,
  });
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function backoff(attempt: number): number {
  return (
    Math.min(8_000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250)
  );
}

function wait(duration: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal.reason));
      return;
    }
    const timer = setTimeout(resolve, duration);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError(signal.reason));
      },
      { once: true },
    );
  });
}

function combineSignals(
  first?: AbortSignal,
  second?: AbortSignal,
): AbortSignal {
  const signals = [first, second].filter((signal): signal is AbortSignal =>
    Boolean(signal),
  );
  const onlySignal = signals[0];
  if (signals.length === 0) return new AbortController().signal;
  if (signals.length === 1 && onlySignal) return onlySignal;
  return AbortSignal.any(signals);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function abortError(reason?: unknown): DOMException {
  return reason instanceof DOMException
    ? reason
    : new DOMException("Request aborted", "AbortError");
}

function normalizeNetworkError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isAbort(error)) {
    return new AppError({
      code: "PROVIDER_TIMEOUT",
      message: "The Anthropic request ended before completion.",
      safeDetail: "The request timed out or was cancelled.",
      suggestedAction: "Retry or increase the feature timeout.",
      retryable: true,
      cause: error,
    });
  }
  return new AppError({
    code: "OFFLINE",
    message: "Anthropic is unreachable.",
    safeDetail: "The browser could not reach the provider.",
    suggestedAction: "Check connectivity and retry.",
    retryable: true,
    cause: error,
  });
}

function malformedResponse(message: string, cause?: unknown): AppError {
  return new AppError({
    code: "MALFORMED_MODEL_RESPONSE",
    message: "Anthropic returned an unusable structured response.",
    safeDetail: message,
    suggestedAction: "Retry or select a different model.",
    retryable: true,
    cause,
  });
}

function cancelledError(cause?: unknown): AppError {
  return new AppError({
    code: "CANCELLED",
    message: "The Anthropic request was cancelled.",
    safeDetail: "The operation ended before completion.",
    suggestedAction: "Retry when ready.",
    retryable: true,
    cause,
  });
}
