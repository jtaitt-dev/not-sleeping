import { AnthropicProvider } from "@/providers/ai/anthropic/anthropic-provider";
import { AiProviderRegistry } from "@/providers/ai/provider-registry";
import { OpenAIProvider } from "@/providers/openai/openai-provider";
import { SleeperProvider } from "@/providers/sleeper/sleeper-provider";
import { SleeperPlayerContextProvider } from "@/providers/sleeper/sleeper-player-context-provider";
import { OpenMeteoProvider } from "@/providers/weather/open-meteo-provider";
import { db } from "@/services/cache/database";
import { showLocalAlert } from "@/services/alerts/alert-service";
import { LiveDraftController } from "@/services/context/live-draft-controller";
import {
  buildLiveDraftState,
  resolveDraftLeagueId,
} from "@/services/context/live-draft-state";
import { mergeTeamDefenseFallback } from "@/services/context/team-defense-fallback";
import { AppError, normalizeError } from "@/services/errors/app-error";
import { DecisionPipeline } from "@/services/decision-pipeline/decision-pipeline";
import { PlayerResearchService } from "@/services/intelligence/player-research-service";
import { LeagueService } from "@/services/league/league-service";
import {
  validateMessage,
  validateSender,
  type RuntimeMessage,
} from "@/services/messaging/protocol";
import { exportRedactedDiagnostics } from "@/services/security/diagnostics";
import { logger } from "@/services/security/logger";
import {
  getKeyStatus,
  getAllProviderKeyStatuses,
  readProviderKeyInServiceWorker,
  readKeyInServiceWorker,
  restrictSecretStorage,
} from "@/services/storage/key-vault";
import { getSettings } from "@/services/storage/settings";
import type {
  AiProviderId,
  LiveDraftState,
  Player,
  Position,
} from "@/types/domain";
import type { SleeperRoster } from "@/schemas/sleeper";

const CONTEXT_KEY = "currentSleeperContext";
const DEMO_KEY = "demoMode";
const ACTIVE_LEAGUE_KEY = "activeLeagueId";
const sleeper = new SleeperProvider();
const sleeperPlayerContext = new SleeperPlayerContextProvider(sleeper);
const weather = new OpenMeteoProvider();
const leagues = new LeagueService(sleeper);
const openai = new OpenAIProvider({
  getKey: async () => (await readKeyInServiceWorker()).key,
  getSettings,
});
const anthropic = new AnthropicProvider({
  getKey: async () => (await readProviderKeyInServiceWorker("anthropic")).key,
  getSettings,
});
const aiProviders = new AiProviderRegistry([openai, anthropic]);
const decisionPipeline = new DecisionPipeline(aiProviders, getSettings);
const playerResearch = new PlayerResearchService(aiProviders, getSettings);
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
      const [context, keyStatus, providerKeyStatuses, players, metadata, demo] =
        await Promise.all([
          chrome.storage.session.get(CONTEXT_KEY),
          getKeyStatus(),
          getAllProviderKeyStatuses(),
          db.players.count(),
          db.cacheMetadata.toArray(),
          chrome.storage.local.get(DEMO_KEY),
        ]);
      return {
        extensionVersion: chrome.runtime.getManifest().version,
        context: context[CONTEXT_KEY] ?? null,
        keyStatus,
        providerKeyStatuses,
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
    case "SYNC_LEAGUES":
      return leagues.syncCatalog({
        userId: message.payload.userId,
        seasons: message.payload.seasons,
        week: message.payload.week,
      });
    case "GET_LEAGUES": {
      const [catalog, active] = await Promise.all([
        leagues.getCatalog(),
        chrome.storage.local.get(ACTIVE_LEAGUE_KEY),
      ]);
      return { catalog, activeLeagueId: active[ACTIVE_LEAGUE_KEY] ?? null };
    }
    case "SELECT_LEAGUE": {
      for (const controller of activeRequests.values()) controller.abort();
      activeRequests.clear();
      const context = await leagues.selectLeague({
        leagueId: message.payload.leagueId,
        userId: message.payload.userId,
        week: message.payload.week,
      });
      await chrome.storage.local.set({ [ACTIVE_LEAGUE_KEY]: context.leagueId });
      return context;
    }
    case "FAVORITE_LEAGUE":
      await leagues.favoriteLeague(
        message.payload.leagueId,
        message.payload.favorite,
      );
      return { saved: true };
    case "SET_LEAGUE_OVERRIDES": {
      const context = await leagues.selectLeague({
        leagueId: message.payload.leagueId,
        userId: message.payload.userId,
        overrides: message.payload.overrides,
      });
      return context;
    }
    case "SAVE_LEAGUE_WORKSPACE":
      await leagues.saveWorkspace({
        ...message.payload,
        updatedAt: Date.now(),
      });
      return { saved: true };
    case "GET_LEAGUE_WORKSPACE":
      return leagues.getWorkspace(
        message.payload.leagueId,
        message.payload.workspace,
      );
    case "GET_LEAGUE_SNAPSHOT": {
      const leagueId = message.payload.leagueId;
      const week = message.payload.week;
      const [
        league,
        users,
        rosters,
        matchups,
        transactions,
        winnersBracket,
        losersBracket,
        tradedPicks,
        drafts,
      ] = await Promise.all([
        sleeper.getLeague(leagueId),
        sleeper.getLeagueUsers(leagueId),
        sleeper.getRosters(leagueId),
        sleeper.getMatchups(leagueId, week),
        sleeper.getTransactions(leagueId, week),
        optionalSleeper(() => sleeper.getWinnersBracket(leagueId)),
        optionalSleeper(() => sleeper.getLosersBracket(leagueId)),
        sleeper.getLeagueTradedPicks(leagueId),
        sleeper.getLeagueDrafts(leagueId),
      ]);
      await sleeper.refreshPlayers().catch(() => null);
      const rosterPlayerIds = [
        ...new Set(
          rosters.flatMap((roster) => [
            ...(roster.players ?? []),
            ...(roster.starters ?? []),
            ...(roster.reserve ?? []),
            ...(roster.taxi ?? []),
          ]),
        ),
      ];
      const [players, projections] = await Promise.all([
        db.players.bulkGet(rosterPlayerIds),
        optionalSleeper(() => sleeper.getNflProjections(league.season)),
      ]);
      const snapshotPlayers = players.filter(
        (player): player is Player => player !== undefined,
      );
      void emitSnapshotAlerts({
        leagueId,
        week,
        rosters,
        players: snapshotPlayers,
      }).catch(() => undefined);
      return {
        leagueId,
        week,
        fetchedAt: Date.now(),
        league,
        users,
        rosters,
        matchups,
        transactions,
        winnersBracket: winnersBracket ?? [],
        losersBracket: losersBracket ?? [],
        tradedPicks,
        drafts,
        players: snapshotPlayers,
        projections: projections ?? [],
      };
    }
    case "GET_STADIUM_WEATHER":
      return weather.getKickoffWeather(message.payload);
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
    case "GET_PLAYER_POOL": {
      if ((await db.players.count()) === 0) await sleeper.refreshPlayers();
      const rows = await db.players
        .orderBy("searchRank")
        .limit(message.payload.limit * 3)
        .toArray();
      const idp = new Set([
        "DL",
        "DE",
        "DT",
        "EDGE",
        "LB",
        "ILB",
        "OLB",
        "DB",
        "CB",
        "S",
        "FS",
        "SS",
      ]);
      return rows
        .filter(
          (player) =>
            !message.payload.rookiesOnly || player.yearsExperience === 0,
        )
        .filter(
          (player) => !message.payload.idpOnly || idp.has(player.position),
        )
        .slice(0, message.payload.limit);
    }
    case "GET_TRENDING_PLAYERS": {
      if ((await db.players.count()) === 0) await sleeper.refreshPlayers();
      const trends = await sleeper.getTrending(
        message.payload.kind,
        24,
        message.payload.limit,
      );
      const players = await db.players.bulkGet(
        trends.map((trend) => trend.player_id),
      );
      const playerMap = new Map(
        players.flatMap((player) => (player ? [[player.id, player]] : [])),
      );
      return trends.flatMap((trend) => {
        const player = playerMap.get(trend.player_id);
        return player ? [{ player, count: trend.count }] : [];
      });
    }
    case "GET_SLEEPER_PLAYER_CONTEXT":
      return sleeperPlayerContext.get(
        message.payload.playerId,
        message.payload.force,
      );
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
    case "RESEARCH_PLAYER": {
      const settings = await getSettings();
      const researchProvider =
        settings.aiFeatureOverrides.research?.provider ??
        settings.aiDefaults.provider;
      await assertProviderPermission(researchProvider);
      const controller = new AbortController();
      activeRequests.set(message.requestId, controller);
      try {
        const result = await playerResearch.research({
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
    case "TEST_AI_PROVIDER":
      await assertProviderPermission(message.payload.provider);
      return aiProviders.get(message.payload.provider).testKey();
    case "LIST_MODELS":
      await assertOpenAIPermission();
      return openai.listModels(message.payload.force);
    case "LIST_AI_MODELS":
      await assertProviderPermission(message.payload.provider);
      return aiProviders
        .get(message.payload.provider)
        .listModels(message.payload.force);
    case "START_REALTIME_DECISION":
      return decisionPipeline.start(message.payload);
    case "GET_REALTIME_DECISION":
      return decisionPipeline.get(message.payload.jobId);
    case "CLEAR_CACHE":
      await clearCache(message.payload.scope);
      return { cleared: message.payload.scope };
    case "EXPORT_DIAGNOSTICS":
      return exportRedactedDiagnostics();
  }
}

async function emitSnapshotAlerts(input: {
  leagueId: string;
  week: number;
  rosters: SleeperRoster[];
  players: Player[];
}): Promise<void> {
  const stored = await db.leagues.get(input.leagueId);
  const roster = input.rosters.find(
    (candidate) => candidate.roster_id === stored?.rosterId,
  );
  if (!roster) return;
  const byId = new Map(input.players.map((player) => [player.id, player]));
  for (const playerId of roster.starters ?? []) {
    const player = byId.get(playerId);
    if (!player) continue;
    if (player.injuryStatus || player.status === "injured") {
      await showLocalAlert({
        id: `${input.leagueId}:${input.week}:injury:${player.id}:${player.injuryStatus ?? player.status}`,
        leagueId: input.leagueId,
        type: "injury_update",
        title: "Starter injury update",
        message:
          "A selected league has a starter with a current injury designation.",
        privateMessage: `${player.fullName}: ${player.injuryStatus ?? player.status}. Review before kickoff.`,
        expiresAt: Date.now() + 24 * 60 * 60_000,
      });
    }
    if (player.status === "inactive") {
      await showLocalAlert({
        id: `${input.leagueId}:${input.week}:inactive:${player.id}`,
        leagueId: input.leagueId,
        type: "inactive_lineup",
        title: "Inactive player in lineup",
        message: "A selected league has an inactive starter.",
        privateMessage: `${player.fullName} is inactive and remains in the reported starter list.`,
        expiresAt: Date.now() + 12 * 60 * 60_000,
      });
    }
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
  return assertProviderPermission("openai");
}

async function assertProviderPermission(provider: AiProviderId): Promise<void> {
  const origin =
    provider === "anthropic"
      ? "https://api.anthropic.com/*"
      : "https://api.openai.com/*";
  const permitted = await chrome.permissions.contains({
    origins: [origin],
  });
  if (!permitted) {
    throw new AppError({
      code: "PERMISSION_FAILURE",
      message: `${provider === "anthropic" ? "Anthropic" : "OpenAI"} access is disabled for this extension.`,
      safeDetail: `Chrome has not granted the extension access to ${new URL(origin).hostname}.`,
      suggestedAction: `Open the extension details, allow ${new URL(origin).hostname} access, and retry.`,
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
