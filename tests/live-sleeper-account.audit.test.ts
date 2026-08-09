import { describe, expect, it } from "vitest";

import { sleeperReadOnlyRequest } from "@/providers/sleeper/read-only-boundary";
import {
  sleeperDraftSchema,
  sleeperLeagueSchema,
  sleeperLeagueUserSchema,
  sleeperNflStateSchema,
  sleeperPlayersSchema,
  sleeperRosterSchema,
  sleeperTradedPickSchema,
  sleeperUserSchema,
  type SleeperPlayerRecord,
} from "@/schemas/sleeper";
import {
  MockDraftSession,
  assertDraftInvariants,
  draftablePlayerPool,
  type DraftEnginePlayer,
} from "@/services/draft/draft-engine";
import { buildLeagueMockDraftPlan } from "@/services/draft/league-mock-config";

const liveAuditEnabled = process.env.RUN_LIVE_SLEEPER_AUDIT === "1";
const accountName = process.env.SLEEPER_AUDIT_USERNAME?.trim() ?? "";

describe.skipIf(!liveAuditEnabled)(
  "live Sleeper account read-only mock audit",
  () => {
    it(
      "completes every current league with legal manual picks and no Sleeper writes",
      { timeout: 300_000 },
      async () => {
        if (!accountName) {
          throw new Error(
            "SLEEPER_AUDIT_USERNAME is required when RUN_LIVE_SLEEPER_AUDIT=1.",
          );
        }
        const user = sleeperUserSchema.parse(
          await sleeperGet(`/v1/user/${encodeURIComponent(accountName)}`),
        );
        const nflState = sleeperNflStateSchema.parse(
          await sleeperGet("/v1/state/nfl"),
        );
        const leagues = sleeperLeagueSchema
          .array()
          .parse(
            await sleeperGet(
              `/v1/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(nflState.season)}`,
            ),
          );
        const playerRecords = sleeperPlayersSchema.parse(
          await sleeperGet("/v1/players/nfl"),
        );
        const players = toEnginePlayers(playerRecords, nflState.season);
        const report: Array<Record<string, unknown>> = [];

        expect(leagues.length).toBeGreaterThanOrEqual(4);
        for (const league of leagues) {
          const [users, rosters, drafts, tradedPicks] = await Promise.all([
            sleeperGet(`/v1/league/${league.league_id}/users`).then((value) =>
              sleeperLeagueUserSchema.array().parse(value),
            ),
            sleeperGet(`/v1/league/${league.league_id}/rosters`).then((value) =>
              sleeperRosterSchema.array().parse(value),
            ),
            sleeperGet(`/v1/league/${league.league_id}/drafts`).then((value) =>
              sleeperDraftSchema.array().parse(value),
            ),
            sleeperGet(`/v1/league/${league.league_id}/traded_picks`).then(
              (value) => sleeperTradedPickSchema.array().parse(value),
            ),
          ]);
          const draft =
            drafts.find(
              (candidate) => candidate.draft_id === league.draft_id,
            ) ??
            drafts.find((candidate) => candidate.status === "pre_draft") ??
            drafts[0] ??
            null;
          const plan = buildLeagueMockDraftPlan({
            league,
            draft,
            rosters,
            users,
            tradedPicks,
            userId: user.user_id,
            userSlotOverride: 1,
          });
          const eligible = draftablePlayerPool(players, plan.config);
          const required = plan.config.teams * plan.config.rounds;
          expect(
            eligible.length,
            `${league.name} eligible player pool`,
          ).toBeGreaterThanOrEqual(required);

          const session = new MockDraftSession(plan.config, players);
          let state = session.start();
          while (state.status !== "complete") {
            const recommendation = session.recommendations(1)[0];
            expect(
              recommendation,
              `${league.name} recommendation at pick ${state.currentPick}`,
            ).toBeDefined();
            state = session.makePick(recommendation!.playerId);
            const validation = assertDraftInvariants(
              plan.config,
              state,
              players,
            );
            expect(
              validation.errors,
              `${league.name} pick ${state.picks.length}`,
            ).toEqual([]);
          }

          expect(new Set(state.picks.map((pick) => pick.playerId)).size).toBe(
            required,
          );
          expect(state.picks).toHaveLength(required);
          if (plan.draftOrderAssigned) {
            expect(
              plan.pickOwnership.every((pick) => pick.pickNumber > 0),
            ).toBe(true);
          } else {
            expect(plan.userSlotSource).toBe("local_choice_required");
            expect(plan.warnings.join(" ")).toContain("not assigned");
          }
          report.push({
            league: league.name,
            teams: plan.config.teams,
            rounds: plan.config.rounds,
            picks: required,
            style: plan.config.style,
            pool: plan.config.playerPool,
            order: plan.draftOrderAssigned ? "verified" : "local slot required",
            tradedPicks: plan.pickOwnership.length,
            result: "all picks legal",
          });
        }

        console.table(report);
      },
    );
  },
);

async function sleeperGet(path: string): Promise<unknown> {
  const url = new URL(path, "https://api.sleeper.app").toString();
  let lastFailure: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, sleeperReadOnlyRequest(url));
      if (!response.ok) {
        throw new Error(`Sleeper returned ${response.status}.`);
      }
      return await response.json();
    } catch (cause) {
      lastFailure = cause;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  throw new Error(`Sleeper GET ${path} failed after 3 attempts.`, {
    cause: lastFailure,
  });
}

function toEnginePlayers(
  records: Record<string, SleeperPlayerRecord>,
  season: string,
): DraftEnginePlayer[] {
  return Object.entries(records).flatMap(([playerId, player], index) => {
    const fantasyPositions = player.fantasy_positions?.filter(Boolean) ?? [];
    const positions =
      fantasyPositions.length > 0
        ? fantasyPositions
        : player.position
          ? [player.position]
          : [];
    if (positions.length === 0) return [];
    const rank = player.search_rank ?? index + 1;
    const value = Math.max(1, Math.min(100, 101 - rank * 0.025));
    const rookieYear = player.metadata?.["rookie_year"];
    const rookie =
      player.years_exp === 0 ||
      (typeof rookieYear === "string" && rookieYear === season);
    const derivedName = [player.first_name, player.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return [
      {
        playerId,
        name: player.full_name ?? (derivedName || playerId),
        positions,
        team: player.team ?? undefined,
        adp: rank,
        tier: Math.floor(rank / 12) + 1,
        redraftValue: value,
        dynastyValue: Math.min(100, value + (rookie ? 8 : 0)),
        contenderValue: value,
        rookie,
        age: player.age ?? undefined,
      },
    ];
  });
}
