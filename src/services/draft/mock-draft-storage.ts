import { z } from "zod";

import type {
  DraftEngineConfig,
  DraftEngineState,
} from "@/services/draft/draft-engine";

export const MOCK_DRAFT_STORAGE_PREFIX = "notSleeping.mockDraft.v1";

const draftEnginePickSchema = z.object({
  pickNumber: z.number().int().positive(),
  round: z.number().int().positive(),
  pickInRound: z.number().int().positive(),
  draftSlot: z.number().int().positive(),
  ownerSlot: z.number().int().positive(),
  playerId: z.string().min(1).max(80),
  isKeeper: z.boolean(),
  price: z.number().nonnegative().optional(),
});

const draftEngineStateSchema = z.object({
  status: z.enum(["pre_draft", "drafting", "paused", "complete"]),
  picks: z.array(draftEnginePickSchema).max(5_120),
  availablePlayerIds: z.array(z.string().min(1).max(80)).max(10_000),
  rosters: z.record(z.string(), z.array(z.string().min(1).max(80)).max(160)),
  budgets: z.record(z.string(), z.number().nonnegative()),
  currentPick: z.number().int().positive(),
  recommendationLatencyMs: z.number().nonnegative(),
});

const storedMockDraftSchema = z.object({
  version: z.literal(1),
  accountId: z.string().min(1).max(80),
  leagueId: z.string().min(1).max(80),
  draftId: z.string().min(1).max(80).nullable(),
  planFingerprint: z.string().min(1).max(160),
  updatedAt: z.number().int().positive(),
  state: draftEngineStateSchema,
});

export type StoredMockDraft = z.infer<typeof storedMockDraftSchema>;

export function mockDraftStorageKey(input: {
  accountId: string;
  leagueId: string;
  draftId: string | null;
}): string {
  const encode = (value: string) => {
    const encoded = encodeURIComponent(value);
    return `${encoded.length}.${encoded}`;
  };
  return [
    MOCK_DRAFT_STORAGE_PREFIX,
    encode(input.accountId),
    encode(input.leagueId),
    encode(input.draftId ?? "local"),
  ].join(":");
}

export function mockDraftPlanFingerprint(config: DraftEngineConfig): string {
  const stable = JSON.stringify({
    leagueType: config.leagueType,
    teams: config.teams,
    rounds: config.rounds,
    style: config.style,
    playerPool: config.playerPool,
    rosterSlots: config.rosterSlots,
    userSlot: config.userSlot,
    tradedPickOwners: config.tradedPickOwners ?? {},
    keepers: config.keepers ?? {},
    superflex: config.superflex ?? false,
    tePremium: config.tePremium ?? false,
    idp: config.idp ?? false,
    bestBall: config.bestBall ?? false,
    positionLimits: config.positionLimits ?? {},
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < stable.length; index += 1) {
    hash = Math.imul(hash ^ stable.charCodeAt(index), 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function saveMockDraft(input: {
  accountId: string;
  leagueId: string;
  draftId: string | null;
  planFingerprint: string;
  state: DraftEngineState;
  now?: number;
}): Promise<StoredMockDraft> {
  const record = storedMockDraftSchema.parse({
    version: 1,
    accountId: input.accountId,
    leagueId: input.leagueId,
    draftId: input.draftId,
    planFingerprint: input.planFingerprint,
    updatedAt: input.now ?? Date.now(),
    state: input.state,
  });
  if (hasChromeStorage()) {
    await chrome.storage.local.set({
      [mockDraftStorageKey(input)]: record,
    });
  }
  return record;
}

export async function loadMockDraft(input: {
  accountId: string;
  leagueId: string;
  draftId: string | null;
  planFingerprint: string;
}): Promise<StoredMockDraft | null> {
  if (!hasChromeStorage()) return null;
  const key = mockDraftStorageKey(input);
  const value = (await chrome.storage.local.get(key))[key];
  const parsed = storedMockDraftSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.planFingerprint !== input.planFingerprint ||
    parsed.data.accountId !== input.accountId ||
    parsed.data.leagueId !== input.leagueId ||
    parsed.data.draftId !== input.draftId
  ) {
    return null;
  }
  return parsed.data;
}

export async function clearMockDraft(input: {
  accountId: string;
  leagueId: string;
  draftId: string | null;
}): Promise<void> {
  if (!hasChromeStorage()) return;
  await chrome.storage.local.remove(mockDraftStorageKey(input));
}

function hasChromeStorage(): boolean {
  const chromeValue: unknown = Reflect.get(globalThis, "chrome");
  if (!chromeValue || typeof chromeValue !== "object") return false;
  const storage: unknown = Reflect.get(chromeValue, "storage");
  return Boolean(storage && typeof storage === "object");
}
