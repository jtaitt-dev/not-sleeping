import { SleeperProvider } from "@/providers/sleeper/sleeper-provider";
import type { SleeperDraft, SleeperLeague } from "@/schemas/sleeper";
import { db, type StoredLeague } from "@/services/cache/database";
import { createLeagueContext } from "@/services/league/league-context";
import {
  effectiveFreshnessPolicies,
  getFreshnessOverrides,
} from "@/services/freshness/freshness-settings";
import type { FreshnessPolicy } from "@/services/freshness/freshness-policy";
import type {
  LeagueContext,
  FreshnessDomain,
  LeagueWorkspaceState,
  ManualLeagueOverrides,
  TeamStrategy,
} from "@/types/league";

export type LeagueCatalogItem = {
  leagueId: string;
  name: string;
  season: string;
  leagueType: LeagueContext["leagueType"];
  lineupType: LeagueContext["lineupType"];
  draftStyle: LeagueContext["draftStyle"];
  favorite: boolean;
  lastUsedAt: number;
  rosterId: number | null;
};

export class LeagueService {
  constructor(
    private readonly sleeper: SleeperProvider,
    private readonly now: () => number = Date.now,
  ) {}

  async syncCatalog(input: {
    userId: string;
    seasons: string[];
    week: number;
    strategy?: TeamStrategy;
  }): Promise<LeagueCatalogItem[]> {
    const seasons = [...new Set(input.seasons)]
      .filter(Boolean)
      .toSorted()
      .toReversed();
    const groups = await Promise.all(
      seasons.map((season) =>
        this.sleeper.getUserLeagues(input.userId, season),
      ),
    );
    const existing = new Map(
      (await db.leagues.toArray()).map((entry) => [entry.leagueId, entry]),
    );
    const freshnessPolicy = effectiveFreshnessPolicies(
      await getFreshnessOverrides(),
    );
    const stored = groups.flatMap((leagues) =>
      leagues.map((league) =>
        this.catalogRecord(
          league,
          input.userId,
          input.week,
          input.strategy ?? "balanced",
          existing.get(league.league_id),
          freshnessPolicy,
        ),
      ),
    );
    await db.leagues.bulkPut(stored);
    return sortCatalog(stored.map(toCatalogItem));
  }

  async getCatalog(): Promise<LeagueCatalogItem[]> {
    return sortCatalog((await db.leagues.toArray()).map(toCatalogItem));
  }

  async selectLeague(input: {
    leagueId: string;
    userId: string;
    week?: number;
    strategy?: TeamStrategy;
    overrides?: ManualLeagueOverrides;
  }): Promise<LeagueContext> {
    const [league, rosters, drafts, nflState, freshnessOverrides] =
      await Promise.all([
        this.sleeper.getLeague(input.leagueId),
        this.sleeper.getRosters(input.leagueId),
        this.sleeper.getLeagueDrafts(input.leagueId),
        this.sleeper.getNflState(),
        getFreshnessOverrides(),
      ]);
    const existing = await db.leagues.get(input.leagueId);
    const draft = selectCurrentDraft(drafts, league.season);
    const overrides = {
      ...(existing?.overrides ?? {}),
      ...(input.overrides ?? {}),
    };
    const context = createLeagueContext({
      league,
      draft,
      rosters,
      userId: input.userId,
      week: input.week ?? nflState.week,
      strategy: input.strategy ?? existing?.context.strategy ?? "balanced",
      fetchedAt: this.now(),
      overrides,
      freshnessPolicy: effectiveFreshnessPolicies(freshnessOverrides),
    });
    await db.leagues.put({
      leagueId: league.league_id,
      season: league.season,
      name: league.name,
      userId: input.userId,
      rosterId: context.rosterId,
      favorite: existing?.favorite ?? false,
      lastUsedAt: this.now(),
      updatedAt: this.now(),
      context,
      overrides,
    });
    return context;
  }

  async favoriteLeague(leagueId: string, favorite: boolean): Promise<void> {
    const league = await db.leagues.get(leagueId);
    if (!league)
      throw new Error("The league is not available in the local catalog.");
    await db.leagues.put({ ...league, favorite, updatedAt: this.now() });
  }

  async saveOverrides(
    leagueId: string,
    overrides: ManualLeagueOverrides,
  ): Promise<void> {
    const league = await db.leagues.get(leagueId);
    if (!league)
      throw new Error("The league is not available in the local catalog.");
    await db.leagues.put({ ...league, overrides, updatedAt: this.now() });
  }

  async saveWorkspace(state: LeagueWorkspaceState): Promise<void> {
    await db.leagueWorkspaces.put({
      ...state,
      id: workspaceId(state.leagueId, state.workspace),
    });
  }

  async getWorkspace(
    leagueId: string,
    workspace: string,
  ): Promise<LeagueWorkspaceState | null> {
    const stored = await db.leagueWorkspaces.get(
      workspaceId(leagueId, workspace),
    );
    if (stored?.leagueId !== leagueId) return null;
    return {
      leagueId: stored.leagueId,
      workspace: stored.workspace,
      week: stored.week,
      scrollTop: stored.scrollTop,
      filters: stored.filters,
      strategy: stored.strategy,
      updatedAt: stored.updatedAt,
    };
  }

  private catalogRecord(
    league: SleeperLeague,
    userId: string,
    week: number,
    strategy: TeamStrategy,
    existing?: StoredLeague,
    freshnessPolicy?: Partial<Record<FreshnessDomain, FreshnessPolicy>>,
  ): StoredLeague {
    const context = createLeagueContext({
      league,
      userId,
      week,
      strategy,
      overrides: existing?.overrides,
      freshnessPolicy,
    });
    return {
      leagueId: league.league_id,
      season: league.season,
      name: league.name,
      userId,
      rosterId: existing?.rosterId ?? null,
      favorite: existing?.favorite ?? false,
      lastUsedAt: existing?.lastUsedAt ?? 0,
      updatedAt: this.now(),
      context,
      overrides: existing?.overrides ?? {},
    };
  }
}

function selectCurrentDraft(
  drafts: SleeperDraft[],
  season: string,
): SleeperDraft | null {
  return (
    drafts.find(
      (draft) => draft.season === season && draft.status === "drafting",
    ) ??
    drafts.find(
      (draft) => draft.season === season && draft.status === "pre_draft",
    ) ??
    drafts.find((draft) => draft.season === season) ??
    drafts[0] ??
    null
  );
}

function toCatalogItem(league: StoredLeague): LeagueCatalogItem {
  return {
    leagueId: league.leagueId,
    name: league.name,
    season: league.season,
    leagueType: league.context.leagueType,
    lineupType: league.context.lineupType,
    draftStyle: league.context.draftStyle,
    favorite: league.favorite,
    lastUsedAt: league.lastUsedAt,
    rosterId: league.rosterId,
  };
}

function sortCatalog(items: LeagueCatalogItem[]): LeagueCatalogItem[] {
  return items.toSorted(
    (left, right) =>
      Number(right.favorite) - Number(left.favorite) ||
      right.lastUsedAt - left.lastUsedAt ||
      right.season.localeCompare(left.season) ||
      left.name.localeCompare(right.name) ||
      left.leagueId.localeCompare(right.leagueId),
  );
}

function workspaceId(leagueId: string, workspace: string): string {
  return `${leagueId}:${workspace.replace(/[^a-z0-9/_-]/gi, "_")}`;
}
