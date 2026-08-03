import type { ZodType } from "zod";

import type {
  AiProviderId,
  AiReasoningEffort,
  AiThinkingMode,
  ModelCapability,
} from "@/types/domain";

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiStructuredRequest<T> = {
  model: string;
  schemaName: string;
  schema: ZodType<T>;
  system: string;
  input: string;
  useWebSearch: boolean;
  allowedDomains?: string[];
  maxOutputTokens?: number;
  timeoutMs?: number;
  reasoningEffort?: AiReasoningEffort;
  thinkingMode?: AiThinkingMode;
  signal?: AbortSignal;
};

export type AiStructuredResult<T> = {
  data: T;
  responseId: string;
  resolvedModel?: string;
  provider: AiProviderId;
  usage: AiUsage;
  citationUrls: string[];
  warnings: string[];
};

export type AiProvider = {
  readonly id: AiProviderId;
  testKey(): Promise<{ ok: true; modelCount: number }>;
  listModels(force?: boolean): Promise<ModelCapability[]>;
  createStructured<T>(
    request: AiStructuredRequest<T>,
  ): Promise<AiStructuredResult<T>>;
};

export type AiProviderResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      provider: AiProviderId;
      code: string;
      message: string;
      retryable: boolean;
    };
