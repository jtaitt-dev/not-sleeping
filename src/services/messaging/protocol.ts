import { z } from "zod";

import { AppError } from "@/services/errors/app-error";
import { containsCredential } from "@/services/security/redaction";

export const PROTOCOL_VERSION = 1 as const;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_MESSAGE_AGE_MS = 2 * 60 * 1000;

const id = z.string().min(1).max(80);
const aiProvider = z.enum(["openai", "anthropic"]);
const aiFeature = z.enum([
  "draft",
  "start_sit",
  "matchup",
  "waiver",
  "trade",
  "dynasty",
  "rookie",
  "taxi",
  "idp",
  "auction",
  "best_ball",
  "chopped",
  "keeper",
  "research",
]);
const decisionCandidate = z.object({
  id,
  label: z.string().min(1).max(160),
  position: z.string().max(20).optional(),
  team: z.string().max(20).optional(),
  baseValue: z.number().min(-10_000).max(10_000).optional(),
  adp: z.number().min(0).max(10_000).optional(),
  projectedPoints: z.number().min(-1_000).max(10_000).optional(),
  rosterFit: z.number().min(-1).max(1).optional(),
  scarcity: z.number().min(0).max(1).optional(),
  risk: z.number().min(0).max(1).optional(),
  available: z.boolean().optional(),
  eligible: z.boolean().optional(),
  alreadySelected: z.boolean().optional(),
  reasons: z.array(z.string().max(500)).max(12).optional(),
  metadata: z
    .record(
      z.string().max(80),
      z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});
const contextPayload = z.object({
  url: z.url().max(2048),
  supported: z.boolean(),
  leagueId: id.optional(),
  draftId: id.optional(),
});

const messageBase = {
  v: z.literal(PROTOCOL_VERSION),
  requestId: z.uuid(),
  timestamp: z.number().int().positive(),
};

export const messageSchema = z.discriminatedUnion("type", [
  z.object({
    ...messageBase,
    type: z.literal("GET_STATUS"),
    payload: z.object({ tabId: z.number().int().nonnegative().optional() }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_LAUNCHER_SETTINGS"),
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_CONTEXT"),
    payload: z.object({ tabId: z.number().int().nonnegative().optional() }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("CONTEXT_UPDATE"),
    payload: contextPayload,
  }),
  z.object({
    ...messageBase,
    type: z.literal("REFRESH_CONTEXT"),
    payload: z.object({
      force: z.boolean().default(false),
      tabId: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("OPEN_SIDE_PANEL"),
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("DETECT_SLEEPER_ACCOUNT"),
    payload: z.object({
      username: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .refine((value) => !/[\s\p{C}]/u.test(value)),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("RESOLVE_USER"),
    payload: z.object({ username: z.string().min(1).max(64) }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SYNC_LEAGUES"),
    payload: z.object({
      userId: id,
      // Both optional: the worker derives them from Sleeper's live NFL state.
      // Callers can't know the real season during the offseason, when the
      // calendar year has already rolled past the active NFL season.
      seasons: z
        .array(z.string().regex(/^\d{4}$/))
        .min(1)
        .max(8)
        .optional(),
      week: z.number().int().min(0).max(30).optional(),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_LEAGUES"),
    payload: z.object({ userId: id }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SELECT_LEAGUE"),
    payload: z.object({
      leagueId: id,
      userId: id,
      week: z.number().int().min(0).max(30).optional(),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("FAVORITE_LEAGUE"),
    payload: z.object({ userId: id, leagueId: id, favorite: z.boolean() }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SET_LEAGUE_OVERRIDES"),
    payload: z.object({
      userId: id,
      leagueId: id,
      overrides: z.object({
        leagueType: z
          .enum(["redraft", "keeper", "dynasty", "unknown"])
          .optional(),
        lineupType: z.enum(["classic", "best_ball", "unknown"]).optional(),
        draftStyle: z
          .enum([
            "snake",
            "linear",
            "third_round_reversal",
            "auction",
            "manual_custom",
            "unknown",
          ])
          .optional(),
        waiverType: z
          .enum([
            "rolling",
            "reverse_standings",
            "faab",
            "faab_with_rolling_tiebreak",
            "custom_daily",
            "free_agents",
            "disabled",
            "unknown",
          ])
          .optional(),
        slotMappings: z
          .record(z.string().max(40), z.array(z.string().max(20)).max(40))
          .optional(),
        scoringLabels: z
          .record(z.string().max(120), z.string().max(200))
          .optional(),
        taxiExperienceLimit: z
          .number()
          .int()
          .min(0)
          .max(99)
          .nullable()
          .optional(),
        taxiDeadline: z.string().max(120).nullable().optional(),
        minimumAuctionBid: z.number().min(0).max(100000).optional(),
        weeklyElimination: z.boolean().optional(),
        eliminationTiebreaker: z.string().max(200).nullable().optional(),
      }),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_LEAGUE_SNAPSHOT"),
    payload: z.object({
      userId: id,
      leagueId: id,
      week: z.number().int().min(0).max(30),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SAVE_LEAGUE_WORKSPACE"),
    payload: z.object({
      userId: id,
      leagueId: id,
      season: z.string().regex(/^\d{4}$/),
      workspace: z.string().min(1).max(120),
      week: z.number().int().min(0).max(30),
      scrollTop: z.number().min(0).max(10_000_000),
      filters: z.record(
        z.string().max(120),
        z.union([
          z.string().max(500),
          z.number(),
          z.boolean(),
          z.array(z.string().max(200)).max(100),
        ]),
      ),
      strategy: z.enum([
        "contender",
        "balanced",
        "productive_struggle",
        "rebuild",
      ]),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_LEAGUE_WORKSPACE"),
    payload: z.object({
      userId: id,
      leagueId: id,
      season: z.string().regex(/^\d{4}$/),
      workspace: z.string().min(1).max(120),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_STADIUM_WEATHER"),
    payload: z.object({
      team: z.string().min(2).max(4),
      kickoff: z.iso.datetime(),
      roofStatus: z.enum(["open", "closed", "unknown"]).optional(),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SET_DEMO_MODE"),
    payload: z.object({
      enabled: z.boolean(),
      fixture: z.string().min(1).max(80).optional(),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SEARCH_PLAYERS"),
    payload: z.object({
      query: z.string().max(100),
      positions: z.array(z.string().max(8)).max(12).optional(),
      limit: z.number().int().min(1).max(100).default(30),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_PLAYER_POOL"),
    payload: z.object({
      limit: z.number().int().min(1).max(1_000).default(400),
      rookiesOnly: z.boolean().default(false),
      idpOnly: z.boolean().default(false),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_TRENDING_PLAYERS"),
    payload: z.object({
      kind: z.enum(["add", "drop"]),
      limit: z.number().int().min(1).max(100),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_SLEEPER_PLAYER_CONTEXT"),
    payload: z.object({
      playerId: id,
      force: z.boolean().default(false),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_DRAFT"),
    payload: z.object({ draftId: id }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_LIVE_DRAFT"),
    payload: z.object({ draftId: id }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("SET_DRAFT_SESSION_OVERRIDE"),
    payload: z.object({
      draftId: id,
      sessionKind: z.enum([
        "league_draft",
        "league_mock",
        "standalone_mock",
        "unknown",
      ]),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("RESEARCH_PLAYER"),
    payload: z.object({
      playerId: id,
      playerName: z.string().min(1).max(160),
      depth: z.enum(["quick", "standard", "deep"]),
      format: z.string().min(1).max(120),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("CANCEL_REQUEST"),
    payload: z.object({ targetRequestId: z.uuid() }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("TEST_OPENAI"),
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("TEST_AI_PROVIDER"),
    payload: z.object({ provider: aiProvider }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("LIST_MODELS"),
    payload: z.object({ force: z.boolean().default(false) }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("LIST_AI_MODELS"),
    payload: z.object({
      provider: aiProvider,
      force: z.boolean().default(false),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("START_REALTIME_DECISION"),
    payload: z.object({
      feature: aiFeature,
      subject: z.string().min(1).max(200),
      contextSummary: z.string().max(8_000),
      candidates: z.array(decisionCandidate).max(200),
      strategy: z.enum([
        "contender",
        "balanced",
        "productive_struggle",
        "rebuild",
      ]),
      riskTolerance: z.number().min(0).max(1),
      picksUntilNext: z.number().int().min(0).max(1_000).optional(),
      currentPick: z.number().int().min(1).max(10_000).optional(),
      facts: z
        .record(
          z.string().max(100),
          z.union([
            z.string().max(1_000),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.string().max(500)).max(50),
            z.array(z.number()).max(100),
          ]),
        )
        .optional(),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_REALTIME_DECISION"),
    payload: z.object({ jobId: z.uuid() }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("CLEAR_CACHE"),
    payload: z.object({
      scope: z.enum(["players", "league", "draft", "research", "all"]),
    }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("EXPORT_DIAGNOSTICS"),
    payload: z.object({}),
  }),
]);

export type RuntimeMessage = z.infer<typeof messageSchema>;
export type RuntimeMessageType = RuntimeMessage["type"];
export type RuntimeMessageInput = RuntimeMessage extends infer Message
  ? Message extends RuntimeMessage
    ? Omit<Message, keyof typeof messageBase>
    : never
  : never;

export function createMessage(input: RuntimeMessageInput): RuntimeMessage {
  return messageSchema.parse({
    ...input,
    v: PROTOCOL_VERSION,
    requestId: crypto.randomUUID(),
    timestamp: Date.now(),
  });
}

export function validateMessage(
  raw: unknown,
  now = Date.now(),
): RuntimeMessage {
  const serialized = JSON.stringify(raw);
  if (new TextEncoder().encode(serialized).byteLength > MAX_MESSAGE_BYTES) {
    throw new AppError({
      code: "PAYLOAD_TOO_LARGE",
      message: "The request is too large.",
      safeDetail: "The extension rejected an oversized runtime message.",
      suggestedAction: "Reduce the request and try again.",
      retryable: false,
    });
  }
  if (containsCredential(raw)) {
    throw new AppError({
      code: "INVALID_MESSAGE",
      message: "Credentials cannot be sent in extension messages.",
      safeDetail: "A credential-like value was rejected.",
      suggestedAction: "Save keys only from the trusted settings page.",
      retryable: false,
    });
  }
  const message = messageSchema.parse(raw);
  if (Math.abs(now - message.timestamp) > MAX_MESSAGE_AGE_MS) {
    throw new AppError({
      code: "STALE_REQUEST",
      message: "The request expired.",
      safeDetail: "A stale runtime message was rejected.",
      suggestedAction: "Retry the action.",
      retryable: true,
    });
  }
  return message;
}

const CONTENT_MESSAGE_TYPES = new Set<RuntimeMessageType>([
  "CONTEXT_UPDATE",
  "DETECT_SLEEPER_ACCOUNT",
  "GET_LAUNCHER_SETTINGS",
  "OPEN_SIDE_PANEL",
]);

export function validateSender(
  sender: chrome.runtime.MessageSender,
  message: RuntimeMessage,
): void {
  if (sender.id !== chrome.runtime.id) {
    throw new AppError({
      code: "PERMISSION_FAILURE",
      message: "The request source is not trusted.",
      safeDetail: "The runtime sender ID did not match this extension.",
      suggestedAction: "Reload the extension and try again.",
      retryable: false,
    });
  }
  const senderUrl = sender.url ?? sender.tab?.url ?? "";
  if (senderUrl.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
    return;
  }
  if (sender.tab) {
    const hostname = safeHostname(senderUrl);
    if (
      !CONTENT_MESSAGE_TYPES.has(message.type) ||
      !isSupportedSleeperHost(hostname)
    ) {
      throw new AppError({
        code: "PERMISSION_FAILURE",
        message: "The page cannot perform that action.",
        safeDetail: "A content-script message exceeded its allowed capability.",
        suggestedAction: "Use the Not Sleeping side panel or settings page.",
        retryable: false,
      });
    }
    return;
  }
  throw new AppError({
    code: "PERMISSION_FAILURE",
    message: "The extension context is not trusted.",
    safeDetail: "The sender was not an extension page.",
    suggestedAction: "Reload the extension.",
    retryable: false,
  });
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isSupportedSleeperHost(hostname: string): boolean {
  return hostname === "sleeper.com" || hostname.endsWith(".sleeper.com");
}

export async function sendRuntimeMessage(
  input: RuntimeMessageInput,
): Promise<unknown> {
  return chrome.runtime.sendMessage(createMessage(input));
}
