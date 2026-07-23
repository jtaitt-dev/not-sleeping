import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "@/providers/openai/openai-provider";
import { SleeperProvider } from "@/providers/sleeper/sleeper-provider";
import { DEFAULT_SETTINGS } from "@/services/storage/settings";

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Sleeper provider", () => {
  it("uses encoded read-only endpoints and validates responses", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ user_id: "123", username: "manager" }),
    );
    const provider = new SleeperProvider(fetcher as typeof fetch);
    await expect(provider.getUser("name with space")).resolves.toMatchObject({
      user_id: "123",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.sleeper.app/v1/user/name%20with%20space",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it.each([
    [429, "SLEEPER_RATE_LIMIT"],
    [404, "SLEEPER_UNAVAILABLE"],
    [503, "SLEEPER_UNAVAILABLE"],
  ])("maps HTTP %s safely", async (status, code) => {
    const provider = new SleeperProvider(
      vi.fn(async () => jsonResponse({}, status)) as typeof fetch,
    );
    await expect(provider.getUser("manager")).rejects.toMatchObject({ code });
  });

  it("distinguishes offline network failures", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const provider = new SleeperProvider(
      vi.fn(async () => {
        throw new TypeError("network");
      }) as typeof fetch,
    );
    await expect(provider.getNflState()).rejects.toMatchObject({
      code: "OFFLINE",
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });
});

describe("OpenAI provider", () => {
  const settings = { ...DEFAULT_SETTINGS, requestTimeoutMs: 10_000 };

  it("requires a key without issuing a request", async () => {
    const fetcher = vi.fn();
    const provider = new OpenAIProvider({
      getKey: async () => null,
      getSettings: async () => settings,
      fetcher,
    });
    await expect(provider.listModels()).rejects.toMatchObject({
      code: "MISSING_KEY",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads, filters, sorts, and caches dynamic models", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        object: "list",
        data: [
          {
            id: "gpt-5.6-sol",
            object: "model",
            created: 1,
            owned_by: "openai",
          },
          { id: "whisper-1", object: "model", created: 1, owned_by: "openai" },
          {
            id: "gpt-5.6-terra",
            object: "model",
            created: 1,
            owned_by: "openai",
          },
        ],
      }),
    );
    const provider = new OpenAIProvider({
      getKey: async () => "sk-abcdefghijklmnop",
      getSettings: async () => settings,
      fetcher,
      now: () => 1_000,
    });
    const models = await provider.listModels();
    expect(models.map((model) => model.id)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ]);
    expect(models[0]).toMatchObject({
      webSearch: true,
      structuredOutput: true,
    });
    await provider.listModels();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends Responses API requests with store false and strict schema", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.store).toBe(false);
      expect(body.tools).toEqual([{ type: "web_search" }]);
      expect(body.text).toMatchObject({
        format: { type: "json_schema", strict: true },
      });
      return jsonResponse({
        id: "resp_1",
        object: "response",
        created_at: 1,
        status: "completed",
        model: "gpt-5.6-sol",
        output_text: JSON.stringify({ verdict: "hold" }),
        output: [],
        usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
      });
    });
    const provider = new OpenAIProvider({
      getKey: async () => "sk-abcdefghijklmnop",
      getSettings: async () => settings,
      fetcher: fetcher as typeof fetch,
    });
    const result = await provider.createStructured({
      model: "gpt-5.6-sol",
      schemaName: "test_contract",
      schema: z.object({ verdict: z.literal("hold") }),
      system: "Return the contract.",
      input: "Evaluate.",
      useWebSearch: true,
    });
    expect(result.data.verdict).toBe("hold");
    expect(result.usage.totalTokens).toBe(14);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer sk-abcdefghijklmnop",
    });
  });

  it("does not retry authentication or quota failures", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: "invalid_api_key",
            message: "bad",
            type: "invalid_request_error",
          },
        },
        401,
      ),
    );
    const provider = new OpenAIProvider({
      getKey: async () => "sk-abcdefghijklmnop",
      getSettings: async () => settings,
      fetcher: fetcher as typeof fetch,
    });
    await expect(provider.listModels(true)).rejects.toMatchObject({
      code: "INVALID_KEY",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
