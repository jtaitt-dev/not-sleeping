import { z } from "zod";

import { AppError } from "@/services/errors/app-error";
import { containsCredential } from "@/services/security/redaction";

export const PROTOCOL_VERSION = 1 as const;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_MESSAGE_AGE_MS = 2 * 60 * 1000;

const id = z.string().min(1).max(80);
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
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_LAUNCHER_SETTINGS"),
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("GET_CONTEXT"),
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("CONTEXT_UPDATE"),
    payload: contextPayload,
  }),
  z.object({
    ...messageBase,
    type: z.literal("REFRESH_CONTEXT"),
    payload: z.object({ force: z.boolean().default(false) }),
  }),
  z.object({
    ...messageBase,
    type: z.literal("OPEN_SIDE_PANEL"),
    payload: z.object({}),
  }),
  z.object({
    ...messageBase,
    type: z.literal("RESOLVE_USER"),
    payload: z.object({ username: z.string().min(1).max(64) }),
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
    type: z.literal("GET_RECOMMENDATIONS"),
    payload: z.object({
      draftId: id.optional(),
      strategy: z.enum([
        "contender",
        "balanced",
        "productive_struggle",
        "rebuild",
      ]),
      riskTolerance: z.number().min(0).max(1),
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
    type: z.literal("LIST_MODELS"),
    payload: z.object({ force: z.boolean().default(false) }),
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
