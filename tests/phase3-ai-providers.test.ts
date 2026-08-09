import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import {
  AnthropicProvider,
  parseAnthropicEventStream,
} from "@/providers/ai/anthropic/anthropic-provider";
import {
  anthropicModelCapability,
  openAIModelCapability,
} from "@/providers/ai/capabilities";
import { OpenAIProvider } from "@/providers/openai/openai-provider";
import {
  getAllProviderKeyStatuses,
  readProviderKeyInServiceWorker,
  saveProviderKeyFromTrustedOptions,
} from "@/services/storage/key-vault";
import {
  appSettingsSchema,
  DEFAULT_SETTINGS,
  migrateSettings,
} from "@/services/storage/settings";

describe("Phase 3 provider-neutral AI", () => {
  it("selects Luna for new users and invalid stored OpenAI models", () => {
    expect(DEFAULT_SETTINGS.routineModel).toBe("gpt-5.6-luna");
    expect(DEFAULT_SETTINGS.aiDefaults).toMatchObject({
      provider: "openai",
      model: "gpt-5.6-luna",
    });
    const invalid = migrateSettings({
      ...DEFAULT_SETTINGS,
      routineModel: "<invalid model>",
      aiDefaults: { ...DEFAULT_SETTINGS.aiDefaults, model: "javascript:" },
    });
    expect(invalid.routineModel).toBe("gpt-5.6-luna");
    expect(invalid.aiDefaults.model).toBe("gpt-5.6-luna");
  });

  it("preserves an existing valid model preference during migration", () => {
    const existing = migrateSettings({
      ...DEFAULT_SETTINGS,
      aiDefaults: {
        ...DEFAULT_SETTINGS.aiDefaults,
        model: "gpt-5.6-terra",
      },
    });
    expect(existing.aiDefaults.model).toBe("gpt-5.6-terra");
  });

  it("migrates Phase 1/2 settings without dropping user values", () => {
    const migrated = migrateSettings({
      settingsVersion: 1,
      sleeperUsername: "nightowl",
      sleeperUserId: "42",
      defaultMode: "best_ball",
      modeOverrides: { league: "keeper" },
      defaultStrategy: "rebuild",
      riskTolerance: 0.7,
      researchDepth: "deep",
      automaticAnalysis: true,
      maxRequestsPerMinute: 3,
      maxConcurrency: 1,
      maxOutputTokens: 1_024,
      requestTimeoutMs: 30_000,
      routineModel: "gpt-5.6-luna",
      researchModel: "gpt-5.6-sol",
      manualModelIds: ["future-model"],
      enablePublicData: true,
      theme: "light",
      reducedMotion: true,
      highContrast: false,
      launcherEnabled: false,
      launcherPosition: "bottom_left",
      logLevel: "info",
      onboardingComplete: true,
    });
    expect(migrated).toMatchObject({
      settingsVersion: 4,
      sleeperUsername: "nightowl",
      defaultMode: "best_ball",
      defaultStrategy: "rebuild",
      routineModel: "gpt-5.6-luna",
      theme: "light",
    });
    expect(migrated.aiDefaults.provider).toBe("openai");
    expect(migrated.aiDefaults.consensusModels).toEqual({
      openai: "gpt-5.6-luna",
      anthropic: "claude-sonnet-4-6",
    });
    expect(migrated.aiFeatureOverrides.research?.webSearch).toBe(true);
    expect(migrated.aiFeatureOverrides.research?.consensusModels).toEqual({
      openai: "gpt-5.6-sol",
      anthropic: "claude-sonnet-4-6",
    });
    expect(migrated.advancedResearchAcknowledgedAt).toBeNull();
    expect(migrated.advancedResearchEnabled).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...DEFAULT_SETTINGS,
        advancedResearchEnabled: true,
        advancedResearchAcknowledgedAt: null,
      }).success,
    ).toBe(false);
  });

  it("never enables advanced research without an acknowledgement", () => {
    const migrated = migrateSettings({
      ...DEFAULT_SETTINGS,
      settingsVersion: 2,
      advancedResearchEnabled: true,
      advancedResearchAcknowledgedAt: null,
    });
    expect(migrated.advancedResearchAcknowledgedAt).toBeNull();
    expect(migrated.advancedResearchEnabled).toBe(false);
  });

  it("isolates OpenAI and Anthropic keys in trusted storage", async () => {
    await saveProviderKeyFromTrustedOptions(
      "openai",
      "sk-openai_abcdefghijkl",
      "session",
    );
    await saveProviderKeyFromTrustedOptions(
      "anthropic",
      "sk-ant-anthropic_abcdefghijkl",
      "remembered",
    );
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      openaiApiKeySession: "sk-openai_abcdefghijkl",
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      anthropicApiKeyRemembered: "sk-ant-anthropic_abcdefghijkl",
      anthropicKeyMode: "remembered",
    });
    const sessionGet = chrome.storage.session.get as unknown as {
      mockResolvedValue(value: unknown): void;
    };
    const localGet = chrome.storage.local.get as unknown as {
      mockResolvedValue(value: unknown): void;
    };
    sessionGet.mockResolvedValue({
      openaiApiKeySession: "sk-openai_abcdefghijkl",
    });
    localGet.mockResolvedValue({
      anthropicApiKeyRemembered: "sk-ant-anthropic_abcdefghijkl",
      anthropicKeyMode: "remembered",
    });

    expect(await readProviderKeyInServiceWorker("openai")).toEqual({
      key: "sk-openai_abcdefghijkl",
      mode: "session",
    });
    expect(await readProviderKeyInServiceWorker("anthropic")).toEqual({
      key: "sk-ant-anthropic_abcdefghijkl",
      mode: "remembered",
    });
    const statuses = await getAllProviderKeyStatuses();
    expect(statuses.openai.masked).not.toContain("abcdefghijkl");
    expect(statuses.anthropic.masked).not.toContain("abcdefghijkl");
    expect(chrome.storage.session.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ anthropicApiKeySession: expect.anything() }),
    );
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ openaiApiKeyRemembered: expect.anything() }),
    );
  });

  it("loads Anthropic models with provider-specific headers", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        "x-api-key": "sk-ant-abcdefghijklmnop",
        "anthropic-version": "2023-06-01",
      });
      expect(init?.headers).not.toHaveProperty("Authorization");
      return jsonResponse({
        data: [
          { id: "claude-sonnet-4-6", type: "model" },
          { id: "claude-haiku-4-5", type: "model" },
        ],
      });
    });
    const provider = new AnthropicProvider({
      getKey: async () => "sk-ant-abcdefghijklmnop",
      getSettings: async () => DEFAULT_SETTINGS,
      fetcher: fetcher as typeof fetch,
      now: () => 1_000,
    });
    const models = await provider.listModels();
    expect(models.map((model) => model.id)).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
    ]);
    expect(models[1]).toMatchObject({
      provider: "anthropic",
      structuredOutput: true,
      webSearch: false,
      thinking: true,
    });
    await provider.listModels();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps Anthropic effort and thinking separate in structured requests", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body["output_config"]).toMatchObject({
        effort: "high",
        format: { type: "json_schema" },
      });
      expect(body["thinking"]).toEqual({ type: "adaptive" });
      expect(body).not.toHaveProperty("tools");
      return jsonResponse({
        id: "msg_1",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: JSON.stringify({ verdict: "hold" }) }],
        usage: { input_tokens: 8, output_tokens: 3 },
      });
    });
    const provider = new AnthropicProvider({
      getKey: async () => "sk-ant-abcdefghijklmnop",
      getSettings: async () => DEFAULT_SETTINGS,
      fetcher: fetcher as typeof fetch,
    });
    const result = await provider.createStructured({
      model: "claude-sonnet-4-6",
      schemaName: "test_contract",
      schema: z.object({ verdict: z.literal("hold") }),
      system: "Return the contract.",
      input: "Evaluate.",
      useWebSearch: true,
      reasoningEffort: "high",
      thinkingMode: "adaptive",
      maxOutputTokens: 2_048,
    });
    expect(result).toMatchObject({
      provider: "anthropic",
      data: { verdict: "hold" },
      usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
      citationUrls: [],
    });
    expect(result.warnings).toContain(
      "This provider/model does not expose native web search.",
    );
  });

  it("omits unsupported OpenAI controls instead of sending them", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).not.toHaveProperty("reasoning");
      expect(body).not.toHaveProperty("tools");
      expect(body).not.toHaveProperty("include");
      return jsonResponse({
        id: "resp_1",
        model: "gpt-4.1",
        output_text: JSON.stringify({ verdict: "hold" }),
        output: [],
        usage: { input_tokens: 8, output_tokens: 3, total_tokens: 11 },
      });
    });
    const provider = new OpenAIProvider({
      getKey: async () => "sk-openai_abcdefghijkl",
      getSettings: async () => DEFAULT_SETTINGS,
      fetcher: fetcher as typeof fetch,
    });
    const result = await provider.createStructured({
      model: "gpt-4.1",
      schemaName: "test_contract",
      schema: z.object({ verdict: z.literal("hold") }),
      system: "Return the contract.",
      input: "Evaluate.",
      useWebSearch: true,
      reasoningEffort: "high",
      thinkingMode: "enabled",
      maxOutputTokens: 2_048,
    });
    expect(result.data).toEqual({ verdict: "hold" });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "This provider/model does not expose native web search.",
        "The selected reasoning effort is not supported.",
        "The selected thinking mode is not supported.",
      ]),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("parses complete Anthropic SSE frames and ignores partial frames", () => {
    expect(
      parseAnthropicEventStream(
        'event: message_start\ndata: {"type":"message_start"}\n\n' +
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n' +
          "data: {partial\n\n",
      ),
    ).toHaveLength(2);
  });

  it("retries Anthropic overload responses using retry-after", async () => {
    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(
          { error: { type: "overloaded_error", message: "busy" } },
          529,
          { "retry-after": "0" },
        );
      }
      return jsonResponse({
        data: [{ id: "claude-sonnet-4-6", type: "model" }],
      });
    });
    const provider = new AnthropicProvider({
      getKey: async () => "sk-ant-abcdefghijklmnop",
      getSettings: async () => DEFAULT_SETTINGS,
      fetcher: fetcher as typeof fetch,
    });
    await expect(provider.testKey()).resolves.toEqual({
      ok: true,
      modelCount: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry Anthropic authentication failures", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { error: { type: "authentication_error", message: "bad key" } },
        401,
      ),
    );
    const provider = new AnthropicProvider({
      getKey: async () => "sk-ant-abcdefghijklmnop",
      getSettings: async () => DEFAULT_SETTINGS,
      fetcher: fetcher as typeof fetch,
    });
    await expect(provider.listModels(true)).rejects.toMatchObject({
      code: "INVALID_KEY",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("distinguishes user cancellation from provider timeout", async () => {
    const fetcher = vi.fn(
      async (_url: string, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(new DOMException("cancelled", "AbortError"));
            return;
          }
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    const controller = new AbortController();
    const provider = new AnthropicProvider({
      getKey: async () => "sk-ant-abcdefghijklmnop",
      getSettings: async () => DEFAULT_SETTINGS,
      fetcher: fetcher as typeof fetch,
    });
    const request = provider.createStructured({
      model: "claude-sonnet-4-6",
      schemaName: "cancel_contract",
      schema: z.object({ verdict: z.string() }),
      system: "Return JSON.",
      input: "Evaluate.",
      useWebSearch: false,
      signal: controller.signal,
    });
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("uses conservative capability contracts for both providers", () => {
    expect(openAIModelCapability("gpt-5.6-sol")).toMatchObject({
      provider: "openai",
      webSearch: true,
      thinking: false,
    });
    expect(anthropicModelCapability("claude-opus-4-6")).toMatchObject({
      provider: "anthropic",
      webSearch: false,
      priceClass: "high",
    });
  });
});

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
