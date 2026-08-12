import type { LeagueSnapshot } from "@/stores/league-store";
import type { Player } from "@/types/domain";
import type { LeagueContext } from "@/types/league";

export type LeagueMemberView = {
  rosterId: number;
  teamName: string;
  ownerName: string;
  avatarUrl: string | null;
  draftPosition: number | null;
  isUser: boolean;
};

export type LeagueStandingView = LeagueMemberView & {
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  waiverLabel: string;
};

export type LeagueActivityMove = {
  kind: "add" | "drop";
  playerName: string;
  position: string;
  team: string;
};

export type LeagueActivityView = {
  id: string;
  actorName: string;
  teamName: string;
  avatarUrl: string | null;
  timestamp: number | null;
  label: string;
  moves: LeagueActivityMove[];
};

export type LeagueSettingView = {
  label: string;
  value: string;
};

export type LeagueOverviewView = {
  members: LeagueMemberView[];
  standings: LeagueStandingView[];
  activity: LeagueActivityView[];
  settings: LeagueSettingView[];
};

export function buildLeagueOverview(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
): LeagueOverviewView | null {
  if (
    snapshot.leagueId !== context.leagueId ||
    snapshot.league.league_id !== context.leagueId
  ) {
    return null;
  }

  const usersById = new Map(snapshot.users.map((user) => [user.user_id, user]));
  const playersById = new Map(
    snapshot.players.map((player) => [player.id, player]),
  );
  for (const player of snapshot.players) {
    if (player.sleeperId) playersById.set(player.sleeperId, player);
  }
  const leagueDrafts = snapshot.drafts.filter(
    (candidate) => candidate.league_id === context.leagueId,
  );
  const draft =
    leagueDrafts.find(
      (candidate) => candidate.draft_id === snapshot.league.draft_id,
    ) ?? leagueDrafts.find((candidate) => candidate.status !== "complete");
  const draftPositionByRoster = new Map<number, number>();
  for (const [userId, slot] of Object.entries(draft?.draft_order ?? {})) {
    const roster = snapshot.rosters.find(
      (candidate) => candidate.owner_id === userId,
    );
    if (roster && Number.isFinite(slot))
      draftPositionByRoster.set(roster.roster_id, slot);
  }
  for (const [slot, rosterId] of Object.entries(
    draft?.slot_to_roster_id ?? {},
  )) {
    const numericSlot = Number(slot);
    if (Number.isFinite(numericSlot) && !draftPositionByRoster.has(rosterId)) {
      draftPositionByRoster.set(rosterId, numericSlot);
    }
  }

  const members = snapshot.rosters
    .map((roster): LeagueMemberView => {
      const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
      return {
        rosterId: roster.roster_id,
        teamName: teamName(
          roster.metadata,
          user?.metadata,
          user?.display_name,
          user?.username,
          roster.roster_id,
        ),
        ownerName: user?.display_name ?? user?.username ?? "Open team",
        avatarUrl: sleeperAvatarUrl(user?.avatar),
        draftPosition: draftPositionByRoster.get(roster.roster_id) ?? null,
        isUser: roster.roster_id === context.rosterId,
      };
    })
    .toSorted((a, b) => a.rosterId - b.rosterId);
  const memberByRoster = new Map(
    members.map((member) => [member.rosterId, member]),
  );

  const standings = snapshot.rosters
    .map((roster) => {
      const member = memberByRoster.get(roster.roster_id);
      if (!member) return null;
      const wins = numericValue(roster.settings, "wins");
      const losses = numericValue(roster.settings, "losses");
      const ties = numericValue(roster.settings, "ties");
      const pointsFor = scoreValue(roster.settings, "fpts", "fpts_decimal");
      const pointsAgainst = scoreValue(
        roster.settings,
        "fpts_against",
        "fpts_against_decimal",
      );
      const startingBudget = numericValue(
        context.settings,
        "waiver_budget",
        100,
      );
      const budgetUsed = numericValue(roster.settings, "waiver_budget_used");
      const waiverPosition = numericValue(roster.settings, "waiver_position");
      const waiverLabel = waiverSummary(
        context.waiverType,
        startingBudget,
        budgetUsed,
        waiverPosition,
      );
      return {
        ...member,
        rank: 0,
        wins,
        losses,
        ties,
        pointsFor,
        pointsAgainst,
        waiverLabel,
      };
    })
    .filter((standing) => standing !== null)
    .toSorted(
      (a, b) =>
        b.wins - a.wins ||
        a.losses - b.losses ||
        b.pointsFor - a.pointsFor ||
        a.rosterId - b.rosterId,
    )
    .map((standing, index) => ({ ...standing, rank: index + 1 }));

  const activity = snapshot.transactions
    .filter((transaction) => transaction.status !== "failed")
    .toSorted(
      (a, b) =>
        transactionTimestamp(b) - transactionTimestamp(a) ||
        b.transaction_id.localeCompare(a.transaction_id),
    )
    .slice(0, 4)
    .map((transaction): LeagueActivityView => {
      const creator = transaction.creator
        ? usersById.get(transaction.creator)
        : undefined;
      const rosterId = transaction.roster_ids[0] ?? null;
      const member =
        rosterId === null ? undefined : memberByRoster.get(rosterId);
      const moves: LeagueActivityMove[] = [
        ...Object.keys(transaction.adds ?? {}).map((playerId) =>
          activityMove("add", playersById.get(playerId)),
        ),
        ...Object.keys(transaction.drops ?? {}).map((playerId) =>
          activityMove("drop", playersById.get(playerId)),
        ),
      ].slice(0, 4);
      return {
        id: transaction.transaction_id,
        actorName:
          creator?.display_name ??
          creator?.username ??
          member?.ownerName ??
          "League",
        teamName: member?.teamName ?? "League activity",
        avatarUrl:
          sleeperAvatarUrl(creator?.avatar) ?? member?.avatarUrl ?? null,
        timestamp: transactionTimestamp(transaction) || null,
        label: transactionLabel(transaction.type, moves),
        moves,
      };
    });

  return {
    members,
    standings,
    activity,
    settings: leagueSettings(context, snapshot),
  };
}

function activityMove(
  kind: LeagueActivityMove["kind"],
  player: Player | undefined,
): LeagueActivityMove {
  return {
    kind,
    playerName: player?.fullName ?? "Player data unavailable",
    position: player?.position ?? "—",
    team: player?.team ?? "FA",
  };
}

function transactionLabel(type: string, moves: LeagueActivityMove[]): string {
  if (type === "trade") return "Completed a trade";
  const adds = moves.filter((move) => move.kind === "add").length;
  const drops = moves.filter((move) => move.kind === "drop").length;
  if (adds && drops) return "Added and dropped players";
  if (adds) return `Added ${adds === 1 ? "a player" : `${adds} players`}`;
  if (drops) return `Dropped ${drops === 1 ? "a player" : `${drops} players`}`;
  return type.replaceAll("_", " ");
}

function leagueSettings(
  context: LeagueContext,
  snapshot: LeagueSnapshot,
): LeagueSettingView[] {
  const settings = context.settings;
  const playoffTeams = numericValue(settings, "playoff_teams");
  const playoffWeek = numericValue(settings, "playoff_week_start");
  const tradeDeadline = numericValue(settings, "trade_deadline");
  const injuredReserve = numericValue(
    settings,
    "reserve_slots",
    context.rosterPositions.filter((slot) => ["IR", "RESERVE"].includes(slot))
      .length,
  );
  const taxi = numericValue(
    settings,
    "taxi_slots",
    context.rosterPositions.filter((slot) => slot === "TAXI").length,
  );
  return [
    {
      label: "Number of Teams",
      value: String(snapshot.league.total_rosters ?? snapshot.rosters.length),
    },
    {
      label: "Roster",
      value: `${context.rosterPositions.length} slots · ${context.lineupType.replaceAll("_", " ")}`,
    },
    {
      label: "Playoffs",
      value:
        playoffTeams > 0
          ? `${playoffTeams} teams${playoffWeek > 0 ? ` · starts week ${playoffWeek}` : ""}`
          : "Not configured",
    },
    {
      label: "Waiver Type",
      value: context.waiverType.replaceAll("_", " "),
    },
    {
      label: "Trade Deadline",
      value: tradeDeadline > 0 ? `Week ${tradeDeadline}` : "None",
    },
    { label: "Injured Reserve Slots", value: String(injuredReserve) },
    { label: "Taxi Slots", value: String(taxi) },
    {
      label: "Draft Pick Trading Allowed",
      value: numericValue(settings, "pick_trading") === 1 ? "Yes" : "No",
    },
    {
      label: "Scoring Categories",
      value: String(Object.keys(context.scoringSettings).length),
    },
  ];
}

function teamName(
  rosterMetadata: Record<string, unknown> | undefined,
  userMetadata: Record<string, unknown> | undefined,
  displayName: string | null | undefined,
  username: string | null | undefined,
  rosterId: number,
): string {
  for (const metadata of [rosterMetadata, userMetadata]) {
    const value = metadata?.["team_name"];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return displayName ?? username ?? `Roster ${rosterId}`;
}

function sleeperAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("https://sleepercdn.com/")) return value;
  if (/^[a-zA-Z0-9_-]+$/.test(value)) {
    return `https://sleepercdn.com/avatars/${value}`;
  }
  return null;
}

function waiverSummary(
  waiverType: LeagueContext["waiverType"],
  startingBudget: number,
  budgetUsed: number,
  waiverPosition: number,
): string {
  if (waiverType === "disabled") return "Disabled";
  if (waiverType === "faab" || waiverType === "faab_with_rolling_tiebreak") {
    const budget = `$${Math.max(0, startingBudget - budgetUsed)}`;
    return waiverType === "faab_with_rolling_tiebreak" && waiverPosition > 0
      ? `${budget} · #${waiverPosition}`
      : budget;
  }
  return waiverPosition > 0 ? `#${waiverPosition}` : "—";
}

function scoreValue(
  settings: Record<string, unknown>,
  wholeKey: string,
  decimalKey: string,
): number {
  return (
    numericValue(settings, wholeKey) + numericValue(settings, decimalKey) / 100
  );
}

function numericValue(
  settings: Record<string, unknown>,
  key: string,
  fallback = 0,
): number {
  const value = settings[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function transactionTimestamp(
  transaction: LeagueSnapshot["transactions"][number],
): number {
  const value = transaction.created ?? transaction.status_updated ?? 0;
  return value > 0 && value < 10_000_000_000 ? value * 1000 : value;
}
