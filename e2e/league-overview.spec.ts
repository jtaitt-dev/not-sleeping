import { expect, test, type BrowserContext } from "@playwright/test";

import { loadExtension } from "./extension-fixture";

test("matches the authenticated Sleeper league geometry at every audit width", async () => {
  test.setTimeout(90_000);
  const loaded = await loadExtension();
  const { context, page, extensionId } = loaded;
  try {
    await installLeagueFixture(context);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        appSettings: {
          onboardingComplete: true,
          sleeperUsername: "league-reviewer",
          sleeperUserId: "league-user-1",
        },
      });
    });
    await page.goto(
      `chrome-extension://${extensionId}/sidepanel.html?fixture=league-overview#/leagues`,
    );
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "League Settings" }),
    ).toBeVisible();

    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await test.step(`${width}px selected league overview`, async () => {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          const read = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            const rect = element?.getBoundingClientRect();
            return {
              selector,
              present: Boolean(element),
              left: rect?.left ?? null,
              right: rect?.right ?? null,
              width: rect?.width ?? null,
              height: rect?.height ?? null,
            };
          };
          const fontSize = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            return element
              ? Number.parseFloat(getComputedStyle(element).fontSize)
              : null;
          };
          const accidentalOverflow = [
            ...document.querySelectorAll<HTMLElement>("body *"),
          ]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              if (!(rect.right > viewport + 0.5 || rect.left < -0.5)) {
                return false;
              }
              let parent = element.parentElement;
              while (parent) {
                const overflow = getComputedStyle(parent).overflowX;
                if (overflow === "auto" || overflow === "scroll") return false;
                parent = parent.parentElement;
              }
              return true;
            })
            .map((element) => element.className)
            .slice(0, 10);
          return {
            viewport,
            documentScrollWidth: document.documentElement.scrollWidth,
            core: [
              read(".league-overview"),
              read(".league-members-panel"),
              read(".league-standings-panel"),
              read(".league-activity-panel"),
              read(".league-settings-panel"),
              read(".league-directory-section"),
            ],
            rows: {
              team: read(".league-member-row"),
              standing: read(".league-standing-row"),
              activity: read(".league-activity-row"),
              setting: read(".league-setting-row"),
            },
            avatars: {
              team: read(".league-member-row__avatar"),
              standing: read(".league-standing-row__avatar"),
            },
            typography: {
              panelTitle: fontSize(".league-overview-panel h2"),
              teamName: fontSize(".league-member-row__copy strong"),
              teamMeta: fontSize(".league-member-row__copy small"),
              setting: fontSize(".league-setting-row dt"),
            },
            semantics: {
              teamItems: document.querySelectorAll(
                '[aria-label="League teams"] [role="listitem"]',
              ).length,
              standingItems: document.querySelectorAll(
                '[aria-label="League standings"] [role="listitem"]',
              ).length,
              settingTerms: document.querySelectorAll(
                ".league-settings-list dt",
              ).length,
              settingDefinitions: document.querySelectorAll(
                ".league-settings-list dd",
              ).length,
            },
            accidentalOverflow,
          };
        });

        expect(layout.viewport).toBe(width);
        expect(layout.documentScrollWidth).toBeLessThanOrEqual(width);
        expect(layout.accidentalOverflow).toEqual([]);
        expect(
          layout.core.filter(
            (entry) =>
              !entry.present ||
              entry.left === null ||
              entry.right === null ||
              entry.width === null ||
              entry.left < -0.5 ||
              entry.right > width + 0.5 ||
              entry.width > 750.5,
          ),
        ).toEqual([]);
        expect(layout.rows.team.height).toBe(92);
        expect(layout.rows.standing.height).toBe(60);
        expect(layout.rows.activity.height).toBeGreaterThanOrEqual(116);
        expect(layout.rows.setting.height).toBe(72);
        expect(layout.avatars.team).toMatchObject({ width: 32, height: 32 });
        expect(layout.avatars.standing).toMatchObject({
          width: 16,
          height: 16,
        });
        expect(layout.typography).toEqual({
          panelTitle: 18,
          teamName: 14,
          teamMeta: 10,
          setting: 12,
        });
        expect(layout.semantics).toEqual({
          teamItems: 12,
          standingItems: 12,
          settingTerms: 9,
          settingDefinitions: 9,
        });

        await test.info().attach(`league-overview-${width}x900`, {
          body: await page.screenshot({ animations: "disabled" }),
          contentType: "image/png",
        });
      });
    }
  } finally {
    await loaded.context.close();
  }
});

async function installLeagueFixture(context: BrowserContext) {
  const leagueId = "league-overview-fixture";
  const teams = 12;
  const users = Array.from({ length: teams }, (_, index) => ({
    user_id: `league-user-${index + 1}`,
    username: `league-manager-${index + 1}`,
    display_name: index === 0 ? "League Reviewer" : `Manager ${index + 1}`,
    avatar: null,
    metadata: {
      team_name: index === 0 ? "Night Shift" : `Fictional Team ${index + 1}`,
    },
  }));
  const rosters = users.map((user, index) => ({
    roster_id: index + 1,
    owner_id: user.user_id,
    league_id: leagueId,
    players: [`fixture-player-${index + 1}`],
    starters: [`fixture-player-${index + 1}`],
    reserve: [],
    taxi: [],
    settings: {
      wins: teams - index,
      losses: index,
      ties: 0,
      fpts: 1_500 - index * 25,
      fpts_decimal: index,
      fpts_against: 1_200 + index * 10,
      fpts_against_decimal: index,
      waiver_budget_used: index * 2,
      waiver_position: index + 1,
    },
    metadata: {},
  }));
  const players = Object.fromEntries(
    rosters.map((roster, index) => {
      const playerId = roster.players[0];
      return [
        playerId,
        {
          player_id: playerId,
          first_name: "Fixture",
          last_name: String(index + 1),
          full_name: `Fixture Player ${index + 1}`,
          position: ["QB", "RB", "WR", "TE"][index % 4],
          fantasy_positions: [["QB", "RB", "WR", "TE"][index % 4]],
          team: ["BUF", "KC", "PHI", "DET"][index % 4],
          age: 24,
          years_exp: 2,
          status: "active",
          injury_status: null,
          search_rank: index + 1,
        },
      ];
    }),
  );
  const league = {
    league_id: leagueId,
    name: "Browser League Overview 2026",
    season: "2026",
    sport: "nfl",
    status: "pre_draft",
    total_rosters: teams,
    draft_id: "league-overview-draft",
    avatar: null,
    previous_league_id: null,
    settings: {
      type: 0,
      waiver_budget: 100,
      waiver_type: 2,
      playoff_teams: 6,
      playoff_week_start: 15,
      trade_deadline: 11,
      reserve_slots: 3,
      taxi_slots: 4,
      pick_trading: 1,
    },
    scoring_settings: { pass_td: 4, rec: 1 },
    roster_positions: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "SUPER_FLEX",
      "BN",
      "IR",
      "TAXI",
    ],
    metadata: {},
  };
  const draft = {
    draft_id: league.draft_id,
    league_id: leagueId,
    type: "snake",
    status: "pre_draft",
    season: "2026",
    sport: "nfl",
    settings: { teams, rounds: 18 },
    metadata: {},
    draft_order: Object.fromEntries(
      users.map((user, index) => [user.user_id, index + 1]),
    ),
    slot_to_roster_id: Object.fromEntries(
      rosters.map((roster) => [String(roster.roster_id), roster.roster_id]),
    ),
  };
  const transactions = [
    {
      transaction_id: "fixture-add",
      type: "waiver",
      status: "complete",
      creator: "league-user-1",
      created: 1_786_484_800_000,
      roster_ids: [1],
      consenter_ids: [],
      adds: { "fixture-player-1": 1 },
      drops: null,
      draft_picks: [],
      waiver_budget: [],
      settings: {},
      metadata: {},
    },
  ];
  const nflState = {
    week: 1,
    season_type: "pre",
    season_start_date: "2026-09-08",
    season: "2026",
    previous_season: "2025",
    leg: 1,
  };

  await context.route("https://api.sleeper.app/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405, body: "GET only" });
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/^\/v1/, "");
    let body: unknown = [];
    if (path === "/state/nfl") body = nflState;
    else if (path === "/user/league-user-1/leagues/nfl/2026") body = [league];
    else if (path.startsWith("/user/league-user-1/leagues/nfl/")) body = [];
    else if (path === `/league/${leagueId}`) body = league;
    else if (path === `/league/${leagueId}/users`) body = users;
    else if (path === `/league/${leagueId}/rosters`) body = rosters;
    else if (path === `/league/${leagueId}/drafts`) body = [draft];
    else if (path === `/league/${leagueId}/transactions/1`) body = transactions;
    else if (path === "/players/nfl") body = players;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
