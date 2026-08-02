import { OpenAIProvider } from "@/providers/openai/openai-provider";
import { SleeperProvider } from "@/providers/sleeper/sleeper-provider";
import { db } from "@/services/cache/database";
import { LiveDraftController } from "@/services/context/live-draft-controller";
import {
  buildLiveDraftState,
  resolveDraftLeagueId,
} from "@/services/context/live-draft-state";
import { mergeTeamDefenseFallback } from "@/services/context/team-defense-fallback";
import { AppError, normalizeError } from "@/services/errors/app-error";
import {
  validateMessage,
  validateSender,
  type RuntimeMessage,
} from "@/services/messaging/protocol";
import { exportRedactedDiagnostics } from "@/services/security/diagnostics";
import { logger } from "@/services/security/logger";
import {
  getKeyStatus,
  readKeyInServiceWorker,
  restrictSecretStorage,
} from "@/services/storage/key-vault";
import { getSettings } from "@/services/storage/settings";
import type { LiveDraftState, Position } from "@/types/domain";

const CONTEXT_KEY = "currentSleeperContext";
const DEMO_KEY = "demoMode";
const sleeper = new SleeperProvider();
const openai = new OpenAIProvider({
  getKey: async () => (await readKeyInServiceWorker()).key,
  getSettings,
});
const liveDraft = new LiveDraftController(loadLiveDraft);
const activeRequests = new Map<string, AbortController>();

export default defineBackground(() => {
  void initialize();

  chrome.runtime.onInstalled.addListener(() => {
    void initialize();
    void chrome.alarms.create("cache-maintenance", { periodInMinutes: 30 });
  });

  chrome.runtime.onStartup.addListener(() => void initialize());
  chrome.runtime.onConnect.addListener((port) => liveDraft.connect(port));
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "cache-maintenance") void maintainCaches();
  });

  chrome.runtime.onMessage.addListener(
    (
      raw: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      void handleIncoming(raw, sender).then(sendResponse);
      return true;
    },
  );
});

async function initialize() {
  await restrictSecretStorage();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  const stored = await chrome.storage.session.get(CONTEXT_KEY);
  const context = asRecord(stored[CONTEXT_KEY]);
  liveDraft.updateContext({
    ...(typeof context["draftId"] === "string"
      ? { draftId: context["draftId"] }
      : {}),
    ...(typeof context["status"] === "string"
      ? { status: context["status"] }
      : {}),
  });
}

async function handleIncoming(
  raw: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  let requestId = "unknown";
  try {
    const message = validateMessage(raw);
    requestId = message.requestId;
    validateSender(sender, message);
    const data = await routeMessage(message, sender);
    return { ok: true, requestId, data };
  } catch (error) {
    const safe = normalizeError(error).toSafeObject();
    logger.warning("runtime_message_rejected", {
      requestId,
      code: safe.code,
    });
    return { ok: false, requestId, error: safe };
  }
}

async function routeMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "GET_STATUS": {
      const [context, keyStatus, players, metadata, demo] = await Promise.all([
        chrome.storage.session.get(CONTEXT_KEY),
        getKeyStatus(),
        db.players.count(),
        db.cacheMetadata.toArray(),
        chrome.storage.local.get(DEMO_KEY),
      ]);
      return {
        extensionVersion: chrome.runtime.getManifest().version,
        context: context[CONTEXT_KEY] ?? null,
        keyStatus,
        players,
        cacheMetadata: metadata,
        demo: demo[DEMO_KEY] ?? { enabled: false },
      };
    }
    case "GET_LAUNCHER_SETTINGS": {
      const settings = await getSettings();
      return {
        enabled: settings.launcherEnabled,
        position: settings.launcherPosition,
      };
    }
    case "GET_CONTEXT": {
      return (
        (await chrome.storage.session.get(CONTEXT_KEY))[CONTEXT_KEY] ?? null
      );
    }
    case "CONTEXT_UPDATE": {
      const context = {
        ...message.payload,
        lastUpdatedAt: Date.now(),
      };
      await chrome.storage.session.set({ [CONTEXT_KEY]: context });
      liveDraft.updateContext({
        ...(context.draftId ? { draftId: context.draftId } : {}),
      });
      return context;
    }
    case "REFRESH_CONTEXT": {
      await liveDraft.refreshNow();
      return (
        (await chrome.storage.session.get(CONTEXT_KEY))[CONTEXT_KEY] ?? null
      );
    }
    case "OPEN_SIDE_PANEL": {
      const tabId = sender.tab?.id;
      if (!tabId) {
        throw new Error("A page tab is required to open the side panel.");
      }
      await chrome.sidePanel.open({ tabId });
      return { opened: true };
    }
    case "RESOLVE_USER": {
      const user = await sleeper.getUser(message.payload.username);
      const settings = await getSettings();
      await chrome.storage.local.set({
        appSettings: {
          ...settings,
          sleeperUsername: user.username ?? message.payload.username,
          sleeperUserId: user.user_id,
        },
      });
      return user;
    }
    case "SET_DEMO_MODE": {
      const demo = {
        enabled: message.payload.enabled,
        fixture: message.payload.fixture ?? "startup",
      };
      await chrome.storage.local.set({ [DEMO_KEY]: demo });
      return demo;
    }
    case "SEARCH_PLAYERS": {
      if ((await db.players.count()) === 0) {
        await sleeper.refreshPlayers();
      }
      return sleeper.searchPlayers(
        message.payload.query,
        (message.payload.positions ?? []) as Position[],
        message.payload.limit,
      );
    }
    case "GET_DRAFT": {
      const [draft, picks, tradedPicks] = await Promise.all([
        sleeper.getDraft(message.payload.draftId),
        sleeper.getDraftPicks(message.payload.draftId),
        sleeper.getDraftTradedPicks(message.payload.draftId),
      ]);
      return { draft, picks, tradedPicks, fetchedAt: Date.now() };
    }
    case "GET_LIVE_DRAFT":
      return loadLiveDraft(message.payload.draftId);
    case "GET_RECOMMENDATIONS": {
      return {
        source: "local",
        strategy: message.payload.strategy,
        riskTolerance: message.payload.riskTolerance,
      };
    }
    case "RESEARCH_PLAYER": {
      await assertOpenAIPermission();
      const settings = await getSettings();
      const controller = new AbortController();
      activeRequests.set(message.requestId, controller);
      try {
        const result = await openai.researchPlayer({
          model: settings.researchModel,
          playerId: message.payload.playerId,
          playerName: message.payload.playerName,
          leagueContext: message.payload.format,
          depth: message.payload.depth,
          signal: controller.signal,
        });
        return {
          ...result,
          cited: result.data.citations.length > 0,
        };
      } finally {
        activeRequests.delete(message.requestId);
      }
    }
    case "CANCEL_REQUEST": {
      const controller = activeRequests.get(message.payload.targetRequestId);
      controller?.abort();
      return { cancelled: Boolean(controller) };
    }
    case "TEST_OPENAI":
      await assertOpenAIPermission();
      return openai.testKey();
    case "LIST_MODELS":
      await assertOpenAIPermission();
      return openai.listModels(message.payload.force);
    case "CLEAR_CACHE":
      await clearCache(message.payload.scope);
      return { cleared: message.payload.scope };
    case "EXPORT_DIAGNOSTICS":
      return exportRedactedDiagnostics();
  }
}

async function loadLiveDraft(draftId: string): Promise<LiveDraftState> {
  const playerRefresh = sleeper.refreshPlayers().catch(() => ({
    players: 0,
    stale: true,
    fetchedAt: 0,
  }));
  const [draft, picks, settings, refresh, storedContext] = await Promise.all([
    sleeper.getDraft(draftId),
    sleeper.getDraftPicks(draftId),
    getSettings(),
    playerRefresh,
    chrome.storage.session.get(CONTEXT_KEY),
  ]);
  const leagueId = resolveDraftLeagueId(draft);
  const playerLimit = liveDraftPlayerLimit(draft.settings);
  const [
    league,
    users,
    rosters,
    corePlayers,
    kickers,
    teamDefenses,
    idpPlayers,
    projections,
  ] = await Promise.all([
    leagueId ? optionalSleeper(() => sleeper.getLeague(leagueId)) : null,
    leagueId ? optionalSleeper(() => sleeper.getLeagueUsers(leagueId)) : [],
    leagueId ? optionalSleeper(() => sleeper.getRosters(leagueId)) : [],
    sleeper.searchPlayers("", [], playerLimit),
    sleeper.searchPlayers("", ["K"], 64),
    sleeper.searchPlayers("", ["DEF"], 64),
    sleeper.searchPlayers("", ["DL", "LB", "DB"], 300),
    optionalSleeper(() => sleeper.getNflProjections(draft.season)),
  ]);
  const players = mergeTeamDefenseFallback([
    ...new Map(
      [...corePlayers, ...kickers, ...teamDefenses, ...idpPlayers].map(
        (player) => [player.id, player],
      ),
    ).values(),
  ]);
  const routeContext = asRecord(storedContext[CONTEXT_KEY]);
  return buildLiveDraftState({
    draft,
    picks,
    players,
    projections: projections ?? [],
    settings,
    ...(typeof routeContext["url"] === "string"
      ? { routeUrl: routeContext["url"] }
      : {}),
    league,
    users: users ?? [],
    rosters: rosters ?? [],
    playerIndexStale: refresh.stale,
  });
}

function liveDraftPlayerLimit(settings: Record<string, unknown>): number {
  const teams = typeof settings["teams"] === "number" ? settings["teams"] : 12;
  const rounds =
    typeof settings["rounds"] === "number" ? settings["rounds"] : 20;
  return Math.min(
    1_000,
    Math.max(300, Math.ceil(teams) * Math.ceil(rounds) + 200),
  );
}

async function optionalSleeper<T>(
  request: () => Promise<T>,
): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    logger.warning("optional_sleeper_context_unavailable", {
      code: normalizeError(error).code,
    });
    return null;
  }
}

async function assertOpenAIPermission(): Promise<void> {
  const permitted = await chrome.permissions.contains({
    origins: ["https://api.openai.com/*"],
  });
  if (!permitted) {
    throw new AppError({
      code: "PERMISSION_FAILURE",
      message: "OpenAI access is disabled for this extension.",
      safeDetail:
        "Chrome has not granted the extension access to api.openai.com.",
      suggestedAction:
        "Open the extension details, allow api.openai.com access, and retry.",
      retryable: false,
    });
  }
}

async function clearCache(
  scope: "players" | "league" | "draft" | "research" | "all",
) {
  if (scope === "players" || scope === "all") {
    await Promise.all([
      db.players.clear(),
      db.cacheMetadata.where("key").startsWith("sleeper:nfl-players").delete(),
    ]);
  }
  if (scope === "research" || scope === "all") await db.research.clear();
  if (scope === "league" || scope === "draft" || scope === "all") {
    await db.cacheMetadata
      .where("key")
      .startsWith(`sleeper:${scope === "all" ? "" : scope}`)
      .delete();
  }
}

async function maintainCaches() {
  const now = Date.now();
  await Promise.all([
    db.research.where("expiresAt").below(now).delete(),
    db.diagnostics
      .where("timestamp")
      .below(now - 30 * 24 * 60 * 60_000)
      .delete(),
  ]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
