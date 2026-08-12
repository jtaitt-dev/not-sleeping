import { expect, test, type BrowserContext } from "@playwright/test";
import { resolve } from "node:path";

import { loadExtension } from "./extension-fixture";

test("renders selected-league trade truth at every audited width", async () => {
  test.setTimeout(90_000);
  const loaded = await loadExtension();
  const { context, page, extensionId } = loaded;
  try {
    await installTradeFixture(context);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        appSettings: {
          onboardingComplete: true,
          sleeperUsername: "trade-reviewer",
          sleeperUserId: "trade-user-1",
        },
      });
    });
    await page.goto(
      `chrome-extension://${extensionId}/sidepanel.html?fixture=trade-center#/trade`,
    );
    await expect(
      page.getByRole("heading", { name: "Trade partners" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/via Fictional Partner 2/)).toBeVisible();

    const userAssets = page.getByRole("list", {
      name: "Night Shift trade assets",
    });
    const partnerAssets = page.getByRole("list", {
      name: "Fictional Partner 2 trade assets",
    });
    await userAssets.getByRole("button", { name: /User Receiver/ }).click();
    await partnerAssets
      .getByRole("button", { name: /Partner Tight End/ })
      .click();
    await expect(
      page.getByText("30.0 → 24.0 projected starter pts/week"),
    ).toBeVisible();
    await expect(
      page.getByText("22.0 → 28.0 projected starter pts/week"),
    ).toBeVisible();

    if (process.env.UPDATE_RELEASE_SCREENSHOT === "1") {
      await page.setViewportSize({ width: 520, height: 1_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: resolve(process.cwd(), "docs", "screenshots", "trade-center.png"),
        animations: "disabled",
        fullPage: true,
      });
    }

    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await test.step(`${width}px Trade Center`, async () => {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          const read = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            const rect = element?.getBoundingClientRect();
            return {
              present: Boolean(element),
              left: rect?.left ?? null,
              right: rect?.right ?? null,
              width: rect?.width ?? null,
              height: rect?.height ?? null,
            };
          };
          const assetPickers = [
            ...document.querySelectorAll<HTMLElement>(".asset-picker"),
          ].map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          });
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
              read(".trade-partner-panel"),
              read(".trade-market-strip"),
              read(".season-trade-builder"),
              read(".trade-verdict"),
              read(".trade-finder"),
            ],
            partnerCard: read(".trade-partner-rail button"),
            assetRow: read(".asset-picker li button"),
            assetPickers,
            semantics: {
              partnerItems: document.querySelectorAll(
                '[aria-label="Trade partner rosters"] > li',
              ).length,
              assetLists: document.querySelectorAll(
                ".asset-picker ul[aria-label]",
              ).length,
              pressedAssets: document.querySelectorAll(
                '.asset-picker button[aria-pressed="true"]',
              ).length,
              heading: document.querySelectorAll("#trade-analysis-title")
                .length,
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
              entry.width > 798.5,
          ),
        ).toEqual([]);
        expect(layout.partnerCard).toMatchObject({ width: 112, height: 88 });
        expect(layout.assetRow.height).toBeGreaterThanOrEqual(64);
        expect(layout.assetPickers).toHaveLength(2);
        if (width <= 480) {
          expect(layout.assetPickers[0]?.width).toBe(
            layout.assetPickers[1]?.width,
          );
        } else {
          expect(
            Math.abs(
              (layout.assetPickers[0]?.width ?? 0) -
                (layout.assetPickers[1]?.width ?? 0),
            ),
          ).toBeLessThanOrEqual(1);
        }
        expect(layout.semantics).toEqual({
          partnerItems: 2,
          assetLists: 2,
          pressedAssets: 2,
          heading: 1,
        });

        await test.info().attach(`trade-center-${width}x900`, {
          body: await page.screenshot({ animations: "disabled" }),
          contentType: "image/png",
        });
      });
    }
  } finally {
    await loaded.context.close();
  }
});

async function installTradeFixture(context: BrowserContext) {
  const leagueId = "trade-e2e-league";
  const users = [
    user("trade-user-1", "Trade Reviewer", "Night Shift", "avatar-one"),
    user("trade-user-2", "Partner Owner", "Fictional Partner 2", null),
    user("trade-user-3", "Third Owner", "Fictional Partner 3", null),
  ];
  const rosters = [
    roster(leagueId, 1, "trade-user-1", ["user-qb", "user-rb", "user-wr"]),
    roster(leagueId, 2, "trade-user-2", [
      "partner-qb",
      "partner-rb",
      "partner-te",
    ]),
    roster(leagueId, 3, "trade-user-3", ["third-qb", "third-wr"]),
  ];
  const playerRows = [
    player("user-qb", "User Quarterback", "QB", 170, 1),
    player("user-rb", "User Running Back", "RB", 136, 2),
    player("user-wr", "User Receiver", "WR", 204, 3),
    player("partner-qb", "Partner Quarterback", "QB", 153, 4),
    player("partner-rb", "Partner Running Back", "RB", 119, 5),
    player("partner-te", "Partner Tight End", "TE", 102, 6),
    player("third-qb", "Third Quarterback", "QB", 140, 7),
    player("third-wr", "Third Receiver", "WR", 110, 8),
  ];
  const players = Object.fromEntries(
    playerRows.map((row) => {
      const { projection, ...entry } = row;
      if (!Number.isFinite(projection)) throw new Error("Invalid projection");
      return [entry.player_id, entry];
    }),
  );
  const projections = playerRows.map((entry) => ({
    player_id: entry.player_id,
    stats: { pts_ppr: entry.projection },
  }));
  const league = {
    league_id: leagueId,
    name: "Browser Trade League 2026",
    season: "2026",
    sport: "nfl",
    status: "pre_draft",
    total_rosters: 3,
    draft_id: "trade-e2e-draft",
    avatar: null,
    previous_league_id: null,
    settings: { type: 2, pick_trading: 1, waiver_budget: 100 },
    scoring_settings: {},
    roster_positions: ["QB", "RB", "FLEX", "BN"],
    metadata: {},
  };
  const draft = {
    draft_id: "trade-e2e-draft",
    league_id: leagueId,
    type: "snake",
    status: "pre_draft",
    season: "2026",
    sport: "nfl",
    settings: { teams: 3, rounds: 3 },
    metadata: {},
    slot_to_roster_id: { "1": 1, "2": 2, "3": 3 },
  };
  const tradedPicks = [
    {
      season: "2026",
      round: 1,
      roster_id: 2,
      previous_owner_id: 2,
      owner_id: 1,
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
    else if (path.startsWith("/projections/nfl/")) body = projections;
    else if (path === "/user/trade-user-1/leagues/nfl/2026") body = [league];
    else if (path.startsWith("/user/trade-user-1/leagues/nfl/")) body = [];
    else if (path === `/league/${leagueId}`) body = league;
    else if (path === `/league/${leagueId}/users`) body = users;
    else if (path === `/league/${leagueId}/rosters`) body = rosters;
    else if (path === `/league/${leagueId}/drafts`) body = [draft];
    else if (path === `/league/${leagueId}/traded_picks`) body = tradedPicks;
    else if (path === "/players/nfl") body = players;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

function user(
  userId: string,
  displayName: string,
  teamName: string,
  avatar: string | null,
) {
  return {
    user_id: userId,
    username: displayName.toLowerCase().replaceAll(" ", "-"),
    display_name: displayName,
    avatar,
    metadata: { team_name: teamName },
  };
}

function roster(
  leagueId: string,
  rosterId: number,
  ownerId: string,
  players: string[],
) {
  return {
    roster_id: rosterId,
    owner_id: ownerId,
    league_id: leagueId,
    players,
    starters: players,
    reserve: [],
    taxi: [],
    settings: {},
    metadata: {},
  };
}

function player(
  playerId: string,
  fullName: string,
  position: string,
  projection: number,
  searchRank: number,
) {
  const [firstName, ...lastName] = fullName.split(" ");
  return {
    player_id: playerId,
    first_name: firstName,
    last_name: lastName.join(" "),
    full_name: fullName,
    position,
    fantasy_positions: [position],
    team: "BUF",
    age: 25,
    years_exp: 3,
    status: "Active",
    injury_status: null,
    search_rank: searchRank,
    projection,
  };
}
