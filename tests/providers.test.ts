import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "@/providers/openai/openai-provider";
import {
  assertBoundedPayload,
  normalizeSleeperPlayer,
  SleeperProvider,
} from "@/providers/sleeper/sleeper-provider";
import { sleeperPlayersSchema } from "@/schemas/sleeper";
import { DEFAULT_SETTINGS } from "@/services/storage/settings";

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Sleeper provider", () => {
  it("deduplicates concurrent player catalog refreshes", async () => {
    const provider = new SleeperProvider();
    const refreshPlayersUncached = vi.fn(async () => {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      return { players: 0, stale: false, fetchedAt: 1 };
    });
    Object.defineProperty(provider, "refreshPlayersUncached", {
      value: refreshPlayersUncached,
    });

    await Promise.all([
      provider.refreshPlayers(true),
      provider.refreshPlayers(true),
      provider.refreshPlayers(true),
    ]);

    expect(refreshPlayersUncached).toHaveBeenCalledTimes(1);
  });

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
    expect(fetcher.mock.contexts[0]).toBe(globalThis);
  });

  it("rejects Sleeper objects whose returned identity differs from the request", async () => {
    const leagueProvider = new SleeperProvider(
      vi.fn(async () =>
        jsonResponse({
          league_id: "other-league",
          name: "Wrong league",
          season: "2026",
        }),
      ) as typeof fetch,
    );
    await expect(
      leagueProvider.getLeague("expected-league"),
    ).rejects.toMatchObject({ code: "SLEEPER_UNAVAILABLE" });

    const draftProvider = new SleeperProvider(
      vi.fn(async () =>
        jsonResponse({
          draft_id: "other-draft",
          league_id: "league-1",
          type: "snake",
          status: "pre_draft",
          season: "2026",
        }),
      ) as typeof fetch,
    );
    await expect(
      draftProvider.getDraft("expected-draft"),
    ).rejects.toMatchObject({ code: "SLEEPER_UNAVAILABLE" });

    const rosterProvider = new SleeperProvider(
      vi.fn(async () =>
        jsonResponse([
          {
            roster_id: 1,
            owner_id: "user-1",
            league_id: "other-league",
            players: [],
            starters: [],
          },
        ]),
      ) as typeof fetch,
    );
    await expect(
      rosterProvider.getRosters("expected-league"),
    ).rejects.toMatchObject({ code: "SLEEPER_UNAVAILABLE" });
  });

  it("rejects oversized Sleeper responses before parsing their bodies", async () => {
    const provider = new SleeperProvider(
      vi.fn(async () =>
        jsonResponse({}, 200, {
          "Content-Length": String(5 * 1024 * 1024 + 1),
        }),
      ) as typeof fetch,
    );
    await expect(provider.getLeague("league-1")).rejects.toMatchObject({
      code: "SLEEPER_UNAVAILABLE",
    });
  });

  it("accepts the current player-catalog shape while retaining a node ceiling", () => {
    const playerShape = Object.fromEntries(
      Array.from({ length: 55 }, (_, index) => [`field-${index}`, index]),
    );
    const currentSizeCatalog = Object.fromEntries(
      Array.from({ length: 12_500 }, (_, index) => [
        `player-${index}`,
        playerShape,
      ]),
    );
    const oversizedCatalog = Object.fromEntries(
      Array.from({ length: 22_500 }, (_, index) => [
        `player-${index}`,
        playerShape,
      ]),
    );

    expect(() => assertBoundedPayload(currentSizeCatalog, true)).not.toThrow();
    expect(() => assertBoundedPayload(oversizedCatalog, true)).toThrow(
      /could not be safely used/i,
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

  it("accepts null metadata in the public Sleeper player feed", () => {
    expect(
      sleeperPlayersSchema.parse({
        "4046": {
          player_id: "4046",
          full_name: "Patrick Mahomes",
          position: "QB",
          fantasy_positions: ["QB"],
          metadata: null,
        },
      }),
    ).toHaveProperty("4046.metadata", null);
  });

  it("loads and caches Sleeper's scoring-specific projection feed", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      void url;
      void init;
      return jsonResponse([
        {
          player_id: "qb-1",
          stats: { adp_std: 40.6, pts_std: 320 },
        },
      ]);
    });
    const provider = new SleeperProvider(fetcher as typeof fetch, () => 1_000);

    await expect(
      provider.getNflProjections("2026", ["QB", "RB"]),
    ).resolves.toMatchObject([
      { player_id: "qb-1", stats: { adp_std: 40.6, pts_std: 320 } },
    ]);
    await provider.getNflProjections("2026", ["RB", "QB"]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toContain(
      "https://api.sleeper.app/projections/nfl/2026?",
    );
    expect(fetcher.mock.calls[0]?.[0]).toContain("order_by=adp_std");
    expect(fetcher.mock.calls[0]?.[0]).toContain("position%5B%5D=QB");
  });

  it("preserves granular IDP positions while retaining Sleeper eligibility groups", () => {
    const records = sleeperPlayersSchema.parse({
      edge: {
        player_id: "edge",
        full_name: "Example Edge",
        position: "DE",
        fantasy_positions: ["DL"],
      },
      corner: {
        player_id: "corner",
        full_name: "Example Corner",
        position: "CB",
        fantasy_positions: ["DB"],
      },
    });

    expect(normalizeSleeperPlayer("edge", records.edge!)).toMatchObject({
      position: "DE",
      fantasyPositions: ["DL"],
    });
    expect(normalizeSleeperPlayer("corner", records.corner!)).toMatchObject({
      position: "CB",
      fantasyPositions: ["DB"],
    });
  });

  it("keeps team defenses in the searchable player index", () => {
    const records = sleeperPlayersSchema.parse({
      LAR: {
        player_id: "LAR",
        first_name: "Los Angeles",
        last_name: "Rams",
        position: "DEF",
        team: "LAR",
        fantasy_positions: ["DEF"],
      },
    });

    expect(normalizeSleeperPlayer("LAR", records.LAR!)).toMatchObject({
      id: "LAR",
      fullName: "Los Angeles Rams",
      position: "DEF",
      team: "LAR",
      fantasyPositions: ["DEF"],
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
    expect(fetcher.mock.contexts[0]).toBe(globalThis);
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

  it("sends validated official-only web search domain filters", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        tools: { type: string; filters?: { allowed_domains: string[] } }[];
      };
      expect(body.tools).toEqual([
        {
          type: "web_search",
          filters: { allowed_domains: ["nfl.com", "api.sleeper.app"] },
        },
      ]);
      return jsonResponse({
        id: "resp_official",
        object: "response",
        created_at: 1,
        status: "completed",
        model: "gpt-5.6-sol",
        output_text: JSON.stringify({ verdict: "hold" }),
        output: [],
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      });
    });
    const provider = new OpenAIProvider({
      getKey: async () => "sk-abcdefghijklmnop",
      getSettings: async () => settings,
      fetcher: fetcher as typeof fetch,
    });
    await provider.createStructured({
      model: "gpt-5.6-sol",
      schemaName: "official_contract",
      schema: z.object({ verdict: z.literal("hold") }),
      system: "Use official sources.",
      input: "Evaluate.",
      useWebSearch: true,
      allowedDomains: ["https://NFL.com", "api.sleeper.app"],
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
