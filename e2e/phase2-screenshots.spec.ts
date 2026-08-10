import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { loadExtension, type LoadedExtension } from "./extension-fixture";

let loaded: LoadedExtension;
const screenshotDir = resolve(process.cwd(), "docs", "screenshots");
let openAiResponseDelayMs = 0;

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
  loaded = await loadExtension();
  await installSleeperFixture(loaded.context);
  await installOpenAiFixture(loaded.context);
  await loaded.page.evaluate(async () => {
    await chrome.storage.local.set({
      appSettings: {
        settingsVersion: 4,
        onboardingComplete: true,
        sleeperUsername: "phase2-reviewer",
        sleeperUserId: "user-1",
        defaultMode: "unknown",
        modeOverrides: {},
        defaultStrategy: "balanced",
        riskTolerance: 0.5,
        researchDepth: "standard",
        automaticAnalysis: false,
        maxRequestsPerMinute: 4,
        maxConcurrency: 1,
        maxOutputTokens: 2048,
        requestTimeoutMs: 60_000,
        routineModel: "gpt-5.6-luna",
        researchModel: "gpt-5.6-sol",
        manualModelIds: [],
        enablePublicData: false,
        theme: "dark",
        reducedMotion: false,
        highContrast: false,
        launcherEnabled: true,
        launcherPosition: "bottom_right",
        logLevel: "warning",
      },
    });
  });
  await loaded.page.setViewportSize({ width: 520, height: 1000 });
  await loaded.page.reload();
  await expect(
    loaded.page.getByText("Phase 2 Capability League", { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test.afterAll(async () => {
  await loaded.context.close();
});

test("captures every required Phase 2 workspace from the shipped extension", async () => {
  test.setTimeout(120_000);
  const { page, extensionId } = loaded;
  await captureLeagueSwitcher(page);
  await captureRoute(
    page,
    extensionId,
    "start-sit",
    "Start & Sit",
    "start-sit.png",
  );
  await captureRoute(
    page,
    extensionId,
    "matchup",
    "Matchup Center",
    "matchup-center.png",
  );
  await captureRoute(
    page,
    extensionId,
    "waivers",
    "Waiver Wire",
    "waiver-wire.png",
  );
  await page
    .locator(".faab-band")
    .first()
    .screenshot({
      path: resolve(screenshotDir, "faab-recommendation.png"),
      animations: "disabled",
    });
  await captureRoute(
    page,
    extensionId,
    "trade",
    "Trade Center",
    "trade-center.png",
  );
  await captureRoute(
    page,
    extensionId,
    "dynasty",
    "Dynasty Center",
    "dynasty-center.png",
  );
  await page.setViewportSize({ width: 760, height: 1000 });
  await captureRoute(
    page,
    extensionId,
    "rookie",
    "Rookie Center",
    "rookie-draft.png",
  );
  await page.setViewportSize({ width: 520, height: 1000 });
  await captureRoute(page, extensionId, "taxi", "Taxi Squad", "taxi-squad.png");
  await captureRoute(page, extensionId, "idp", "IDP", "idp-center.png");
  await captureRoute(
    page,
    extensionId,
    "auction",
    "Auction Assistant",
    "auction-assistant.png",
  );
  await captureRoute(
    page,
    extensionId,
    "mock-draft",
    "Mock Draft",
    "mock-draft-lab.png",
  );
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/today`);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.locator(".decision-card").first().click();
  const evidenceDrawer = page.locator(".evidence-drawer");
  await expect(evidenceDrawer).toBeVisible();
  await evidenceDrawer.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(screenshotDir, "evidence-drawer.png"),
    animations: "disabled",
  });
  await captureRoute(
    page,
    extensionId,
    "chopped",
    "Chopped Survival",
    "chopped-survival.png",
  );
});

test("captures premium Draft Copilot release states", async () => {
  test.setTimeout(90_000);
  const { page, extensionId } = loaded;
  await page.setViewportSize({ width: 520, height: 1000 });
  await captureDraftFixture(page, extensionId, "startup", "draft-copilot.png");
  await captureCurrentDraft(page, "draft-premium-waiting.png");
  await captureDraftFixture(
    page,
    extensionId,
    "big-bucks",
    "draft-copilot-big-bucks.png",
  );
  await captureCurrentDraft(page, "draft-premium-on-clock.png");
  await captureCurrentDraft(page, "draft-premium-rookie.png");
  await captureCurrentDraft(page, "draft-premium-ai-off.png");
  await captureDraftFixture(
    page,
    extensionId,
    "auction-draft",
    "draft-copilot-auction.png",
  );
  await captureCurrentDraft(page, "draft-premium-auction.png");

  await page.evaluate(async () => {
    const { appSettings } = await chrome.storage.local.get("appSettings");
    const settings =
      appSettings && typeof appSettings === "object" ? appSettings : {};
    await chrome.storage.session.set({
      openaiApiKeySession: "sk-release_fixture_1234567890",
    });
    await chrome.storage.local.set({
      appSettings: { ...settings, automaticAnalysis: true },
    });
  });
  openAiResponseDelayMs = 2_000;
  await page.reload();
  await expect(page.getByLabel("Enable AI analysis")).toBeChecked();
  await expect(
    page.locator('.draft-copilot[data-ai-status="queued"]'),
  ).toBeVisible();
  await expect(
    page.locator(".draft-copilot__primary .player-avatar img"),
  ).toBeVisible({ timeout: 4_000 });
  await captureCurrentDraft(page, "draft-premium-ai-working.png");
  await expect(page.locator(".draft-copilot")).toHaveAttribute(
    "data-ai-job-id",
    /.+/,
    { timeout: 15_000 },
  );
  const jobId = await page
    .locator(".draft-copilot")
    .getAttribute("data-ai-job-id");
  if (!jobId)
    throw new Error("Draft Copilot did not expose its active AI job.");
  await expect
    .poll(
      async () =>
        page.evaluate(async (activeJobId) => {
          const response: unknown = await chrome.runtime.sendMessage({
            v: 1,
            requestId: crypto.randomUUID(),
            timestamp: Date.now(),
            type: "GET_REALTIME_DECISION",
            payload: { jobId: activeJobId },
          });
          if (
            typeof response !== "object" ||
            response === null ||
            !("data" in response)
          ) {
            return null;
          }
          const data: unknown = response.data;
          return typeof data === "object" &&
            data !== null &&
            "aiStatus" in data &&
            typeof data.aiStatus === "string"
            ? data.aiStatus
            : null;
        }, jobId),
      { timeout: 30_000 },
    )
    .toBe("ready");
  await expect(
    page.locator('.draft-copilot[data-ai-status="ready"]'),
  ).toBeVisible({
    timeout: 30_000,
  });
  await captureCurrentDraft(page, "draft-premium-ai-ready.png");
  openAiResponseDelayMs = 0;
  await page.evaluate(async () => {
    const { appSettings } = await chrome.storage.local.get("appSettings");
    const settings =
      appSettings && typeof appSettings === "object" ? appSettings : {};
    await chrome.storage.local.set({
      appSettings: { ...settings, automaticAnalysis: false },
    });
  });
  await page.reload();
  await expect(page.getByLabel("Enable AI analysis")).not.toBeChecked();
  await page.setViewportSize({ width: 320, height: 900 });
  await captureDraftFixture(
    page,
    extensionId,
    "big-bucks",
    "draft-copilot-320.png",
  );
  await captureCurrentDraft(page, "draft-premium-320.png");
  await page.setViewportSize({ width: 600, height: 1000 });
  await captureDraftFixture(
    page,
    extensionId,
    "startup",
    "draft-premium-600.png",
  );
  await page.setViewportSize({ width: 520, height: 1000 });
});

async function captureLeagueSwitcher(page: Page) {
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/today`,
  );
  await page.locator(".league-switcher-trigger").click();
  await expect(page.getByText("Switch league", { exact: true })).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotDir, "league-switcher.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
}

async function captureRoute(
  page: Page,
  extensionId: string,
  route: string,
  heading: string,
  file: string,
) {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/${route}`);
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(screenshotDir, file),
    animations: "disabled",
  });
}

async function captureDraftFixture(
  page: Page,
  extensionId: string,
  fixture: string,
  file: string,
) {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/draft`);
  await page.evaluate(async (fixtureId) => {
    await chrome.storage.local.set({
      demoMode: { enabled: true, fixture: fixtureId },
    });
  }, fixture);
  // Hash navigation keeps the existing React store alive. Reload so hydration
  // reads the newly selected fixture before the release screenshot is taken.
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: fixture === "auction-draft" ? "Auction Copilot" : "Draft Copilot",
      exact: true,
    }),
  ).toBeVisible();
  if (fixture === "big-bucks") {
    await expect(page.getByText("16 teams", { exact: true })).toBeVisible();
  } else if (fixture === "auction-draft") {
    await expect(page.getByText(/\$182 budget/)).toBeVisible();
  } else {
    await expect(page.getByText("12 teams", { exact: true })).toBeVisible();
  }
  await page.screenshot({
    path: resolve(screenshotDir, file),
    animations: "disabled",
  });
}

async function captureCurrentDraft(page: Page, file: string) {
  await page.screenshot({
    path: resolve(screenshotDir, file),
    animations: "disabled",
  });
}

async function installOpenAiFixture(context: BrowserContext) {
  await context.route("https://api.openai.com/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/models")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          object: "list",
          data: [
            {
              id: "gpt-5.6-luna",
              object: "model",
              created: 0,
              owned_by: "openai",
            },
          ],
        }),
      });
      return;
    }
    if (openAiResponseDelayMs > 0) {
      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, openAiResponseDelayMs),
      );
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "resp_release_fixture",
        model: "gpt-5.6-luna",
        output_text: JSON.stringify({
          recommendationId: null,
          summary:
            "The local leader remains legal after a bounded roster and board review.",
          adjustment: 1,
          confidenceDelta: 0.02,
          reasons: [
            "The verified rookie pool and current pick ownership agree.",
          ],
          risks: ["Opponent intentions remain probabilistic."],
        }),
        output: [],
        usage: { input_tokens: 120, output_tokens: 40, total_tokens: 160 },
      }),
    });
  });
}

async function installSleeperFixture(context: BrowserContext) {
  const data = fixtureData();
  await context.route("https://api.sleeper.app/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/v1/, "");
    let body: unknown = [];
    if (path === "/state/nfl") body = data.state;
    else if (path === "/user/user-1/leagues/nfl/2026") body = [data.league];
    else if (path.startsWith("/user/user-1/leagues/nfl/")) body = [];
    else if (path === "/league/phase2-league") body = data.league;
    else if (path === "/league/phase2-league/users") body = data.users;
    else if (path === "/league/phase2-league/rosters") body = data.rosters;
    else if (path === "/league/phase2-league/drafts") body = data.drafts;
    else if (path === "/league/phase2-league/traded_picks")
      body = data.tradedPicks;
    else if (path.includes("/league/phase2-league/matchups/"))
      body = data.matchups;
    else if (path.includes("/league/phase2-league/transactions/"))
      body = data.transactions;
    else if (
      path.endsWith("/winners_bracket") ||
      path.endsWith("/losers_bracket")
    )
      body = [];
    else if (path === "/players/nfl") body = data.players;
    else if (path === "/projections/nfl/2026") body = data.projections;
    else if (
      path.includes("/players/nfl/trending/add") ||
      path.includes("/players/nfl/trending/drop")
    )
      body = data.trending;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

function fixtureData() {
  const positionPattern = [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "WR",
    "QB",
    "DE",
    "LB",
    "LB",
    "S",
    "CB",
    "RB",
    "WR",
    "TE",
    "LB",
    "DB",
    "RB",
    "WR",
  ];
  const players: Record<string, Record<string, unknown>> = {};
  const projections: Array<{
    player_id: string;
    stats: Record<string, number>;
  }> = [];
  for (let index = 1; index <= 260; index += 1) {
    const position =
      positionPattern[(index - 1) % positionPattern.length] ?? "WR";
    const id = `p${index}`;
    players[id] = {
      player_id: id,
      first_name: `Player`,
      last_name: String(index),
      full_name: `Player ${index}`,
      position,
      fantasy_positions: [position],
      team: ["BUF", "KC", "PHI", "DET", "SF", "DAL"][index % 6],
      age: 20 + (index % 13),
      years_exp: index > 200 ? 0 : index % 9,
      status: index === 4 ? "injured" : "active",
      injury_status: index === 4 ? "Questionable" : null,
      college: `State University ${index % 12}`,
      search_rank: index,
      metadata: {
        rookie_year: index > 200 ? "2026" : String(2018 + (index % 8)),
        draft_round: String((index % 7) + 1),
        draft_pick: String(index % 220),
      },
    };
    projections.push({
      player_id: id,
      stats: { pts_ppr: Math.max(3, 25 - index * 0.055) },
    });
  }
  const rosters = Array.from({ length: 10 }, (_, rosterIndex) => {
    const first = rosterIndex * 20 + 1;
    const rosterPlayers = Array.from(
      { length: 20 },
      (_, offset) => `p${first + offset}`,
    );
    return {
      roster_id: rosterIndex + 1,
      owner_id: `user-${rosterIndex + 1}`,
      league_id: "phase2-league",
      players: rosterPlayers,
      starters: rosterPlayers.slice(0, 13),
      reserve: rosterIndex === 0 ? [rosterPlayers[18]] : [],
      taxi: rosterIndex === 0 ? rosterPlayers.slice(16, 18) : [],
      settings: {
        waiver_budget_used: rosterIndex * 6,
        wins: 8 - (rosterIndex % 5),
        losses: 3 + (rosterIndex % 5),
        eliminated: rosterIndex === 9 ? 1 : 0,
      },
      metadata: {},
    };
  });
  const matchups = rosters.map((roster, rosterIndex) => ({
    roster_id: roster.roster_id,
    matchup_id: Math.floor(rosterIndex / 2) + 1,
    points: 74 + rosterIndex * 4.7,
    custom_points: null,
    players: roster.players,
    starters: roster.starters,
    players_points: Object.fromEntries(
      roster.starters.map((id, index) => [id, 2 + ((rosterIndex + index) % 9)]),
    ),
    starters_points: roster.starters.map(
      (_, index) => 2 + ((rosterIndex + index) % 9),
    ),
  }));
  const users = rosters.map((roster) => ({
    user_id: roster.owner_id,
    username: `manager${roster.roster_id}`,
    display_name:
      roster.roster_id === 1
        ? "Phase 2 Reviewer"
        : `Manager ${roster.roster_id}`,
    avatar: null,
    metadata: {
      team_name:
        roster.roster_id === 1 ? "Night Shift" : `Team ${roster.roster_id}`,
    },
  }));
  const league = {
    league_id: "phase2-league",
    name: "Phase 2 Capability League",
    season: "2026",
    sport: "nfl",
    status: "in_season",
    total_rosters: 10,
    draft_id: "phase2-draft",
    avatar: null,
    previous_league_id: null,
    settings: {
      type: 2,
      best_ball: 0,
      waiver_type: 1,
      waiver_budget: 100,
      waiver_clear_days: 2,
      waiver_day_of_week: 2,
      taxi_slots: 4,
      taxi_years: 2,
      reserve_slots: 2,
      league_average_match: 1,
      disable_trades: 0,
      auction_budget: 200,
      auction_min_bid: 0,
      weekly_elimination: 1,
      elimination_tiebreaker: "season points",
    },
    scoring_settings: {
      pass_yd: 0.04,
      pass_td: 4,
      rush_yd: 0.1,
      rush_td: 6,
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      bonus_rec_te: 0.5,
      tkl_solo: 1.5,
      tkl_ast: 0.75,
      sack: 4,
      int: 5,
      ff: 3,
      fum_rec: 2,
      pass_def: 2,
    },
    roster_positions: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "FLEX",
      "SUPER_FLEX",
      "DL",
      "LB",
      "LB",
      "DB",
      "IDP_FLEX",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "BN",
      "TAXI",
      "TAXI",
      "IR",
    ],
    metadata: {},
  };
  return {
    state: {
      week: 8,
      season_type: "regular",
      season_start_date: "2026-09-08",
      season: "2026",
      previous_season: "2025",
      leg: 8,
    },
    league,
    users,
    rosters,
    matchups,
    players,
    projections,
    drafts: [
      {
        draft_id: "phase2-draft",
        league_id: "phase2-league",
        type: "auction",
        status: "pre_draft",
        season: "2026",
        sport: "nfl",
        settings: { teams: 10, rounds: 20, budget: 200 },
        metadata: {
          name: "Dynasty Auction Startup",
          draft_type: "startup",
          player_pool: "all",
        },
        draft_order: null,
        slot_to_roster_id: null,
        creators: ["user-1"],
      },
    ],
    tradedPicks: [
      {
        season: "2027",
        round: 1,
        roster_id: 2,
        previous_owner_id: 2,
        owner_id: 1,
      },
    ],
    transactions: [
      {
        transaction_id: "waiver-1",
        type: "waiver",
        status: "complete",
        leg: 7,
        creator: "user-2",
        created: Date.now() - 86_400_000,
        status_updated: Date.now() - 86_000_000,
        roster_ids: [2, 10],
        consenter_ids: [],
        adds: { p221: 2 },
        drops: { p199: 10 },
        draft_picks: [],
        waiver_budget: [],
        settings: { waiver_bid: 24 },
        metadata: { reason: "eliminated roster release" },
      },
    ],
    trending: Array.from({ length: 30 }, (_, index) => ({
      player_id: `p${221 + index}`,
      count: 1200 - index * 23,
    })),
  };
}
