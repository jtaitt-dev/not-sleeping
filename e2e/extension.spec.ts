import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { loadExtension, type LoadedExtension } from "./extension-fixture";

let loaded: LoadedExtension;

test.beforeAll(async () => {
  loaded = await loadExtension();
});

test.afterAll(async () => {
  await loaded.context.close();
});

test("loads the MV3 extension and navigates every primary workspace", async () => {
  const { page } = loaded;
  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // Six pills is the contract at 400px; a seventh needs 533px.
  await expect(primaryNav.getByRole("link")).toHaveCount(6);

  for (const workspace of [
    { link: "Draft", heading: "Draft Copilot" },
    { link: "Team", heading: "Team" },
    { link: "Players", heading: "Players" },
    { link: "Trade", heading: "Trade Center" },
    { link: "More", heading: "More" },
  ]) {
    await primaryNav
      .getByRole("link", { name: workspace.link, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: workspace.heading, exact: true }),
    ).toBeVisible();
  }

  await expect(
    page.getByRole("link", { name: "Advanced Research" }),
  ).toHaveCount(0);
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/labs`,
  );
  await expect(page).toHaveURL(/#\/today$/);

  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/advanced-research`,
  );
  await expect(
    page.getByRole("heading", { name: "Explicit opt-in required" }),
  ).toBeVisible();
});

test("distinguishes Sleeper page traffic and keeps extension Sleeper requests GET-only", async () => {
  const { context, page } = loaded;
  const observed: Array<{
    method: string;
    source: "extension-service-worker" | "sleeper-page" | "other";
    url: string;
  }> = [];
  const onRequest = (request: import("@playwright/test").Request) => {
    if (!request.url().startsWith("https://api.sleeper.app/")) return;
    const workerUrl = request.serviceWorker()?.url() ?? "";
    let frameUrl = "";
    try {
      frameUrl = request.frame().url();
    } catch {
      // Service-worker requests intentionally have no frame.
    }
    observed.push({
      method: request.method(),
      source: workerUrl.startsWith("chrome-extension://")
        ? "extension-service-worker"
        : frameUrl.startsWith("https://sleeper.com/")
          ? "sleeper-page"
          : "other",
      url: request.url(),
    });
  };
  context.on("request", onRequest);
  await context.route("https://api.sleeper.app/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/v1/draft/audit-draft"
        ? {
            draft_id: "audit-draft",
            league_id: null,
            type: "mock",
            status: "drafting",
            season: "2026",
            sport: "nfl",
            settings: {},
            metadata: {},
          }
        : path === "/v1/state/nfl"
          ? {
              week: 1,
              season_type: "pre",
              season_start_date: "2026-09-08",
              season: "2026",
            }
          : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
  await context.route("https://sleeper.com/network-audit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>network audit</title>",
    });
  });

  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/draft`,
  );
  const extensionSucceeded = await page.evaluate(async () => {
    const response: unknown = await chrome.runtime.sendMessage({
      v: 1,
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "GET_DRAFT",
      payload: { draftId: "audit-draft" },
    });
    return (
      typeof response === "object" &&
      response !== null &&
      "ok" in response &&
      response.ok === true
    );
  });
  expect(extensionSucceeded).toBe(true);

  const sleeperPage = await context.newPage();
  await sleeperPage.goto("https://sleeper.com/network-audit");
  await sleeperPage.evaluate(async () => {
    await fetch("https://api.sleeper.app/v1/state/nfl");
  });
  await sleeperPage.close();

  await context.unroute("https://sleeper.com/network-audit");
  await context.unroute("https://api.sleeper.app/**");
  context.off("request", onRequest);

  const extensionRequests = observed.filter(
    (request) => request.source === "extension-service-worker",
  );
  expect(extensionRequests.length).toBeGreaterThanOrEqual(3);
  expect(extensionRequests.every((request) => request.method === "GET")).toBe(
    true,
  );
  expect(observed.some((request) => request.source === "sleeper-page")).toBe(
    true,
  );
  expect(observed.every((request) => request.source !== "other")).toBe(true);
});

test("renders every standard side-panel route and the popup without console errors", async () => {
  const { context, page, extensionId } = loaded;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const routes: Array<{ path: string; heading: string | RegExp }> = [
    { path: "today", heading: "Today" },
    { path: "leagues", heading: "Leagues" },
    { path: "draft", heading: "Draft Copilot" },
    { path: "mock-draft", heading: "Choose a Sleeper league" },
    { path: "start-sit", heading: /Start & Sit|Best Ball Optimizer/ },
    { path: "matchup", heading: "Matchup Center" },
    { path: "chopped", heading: "Chopped Survival" },
    { path: "waivers", heading: "Waiver Wire" },
    { path: "players", heading: "Players" },
    { path: "team", heading: "Team" },
    { path: "dynasty", heading: "Dynasty Center" },
    { path: "trade", heading: "Trade Center" },
    { path: "rookie", heading: "Rookie Center" },
    { path: "taxi", heading: "Taxi Squad" },
    { path: "idp", heading: "IDP" },
    { path: "auction", heading: "Auction" },
    { path: "research", heading: "Research" },
    { path: "calendar", heading: "Deadlines" },
    { path: "watchlist", heading: "Watchlist" },
    { path: "more", heading: "More" },
    { path: "compare", heading: "Compare" },
    { path: "rankings", heading: "Rankings" },
    { path: "data-center", heading: "Data Center" },
    { path: "usage", heading: "Usage" },
    { path: "settings", heading: "Settings" },
    { path: "diagnostics", heading: "Diagnostics" },
    { path: "about", heading: "About" },
  ];
  for (const route of routes) {
    await page.goto(
      `chrome-extension://${extensionId}/sidepanel.html#/${route.path}`,
    );
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true }).first(),
    ).toBeVisible();
  }

  const popup = await context.newPage();
  popup.on("console", onConsole);
  popup.on("pageerror", onPageError);
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText("Not Sleeping", { exact: true })).toBeVisible();
  await expect(
    popup.getByRole("button", { name: "Open side panel" }),
  ).toBeVisible();
  await expect(popup.getByText(/read-only Sleeper access/i)).toBeVisible();
  await popup.close();

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("matches measured Sleeper Players density at every audit width", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  const { page, extensionId } = loaded;
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/players`);
  await expect(
    page.getByRole("heading", { name: "Players", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result-list > button").first()).toBeVisible();

  try {
    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await test.step(`${width}px Players workspace`, async () => {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => {
          const row = document.querySelector<HTMLElement>(
            ".result-list > button",
          );
          const avatar = row?.querySelector<HTMLElement>(".player-avatar");
          const fallback = row?.querySelector<HTMLElement>(
            ".player-avatar__fallback",
          );
          const name = row?.querySelector<HTMLElement>(
            ".sleeper-player-identity__copy strong",
          );
          const meta = row?.querySelector<HTMLElement>(
            ".sleeper-player-identity__copy small",
          );
          const search = document.querySelector<HTMLElement>(
            ".players-toolbar .sleeper-search",
          );
          const select = document.querySelector<HTMLElement>(
            ".players-toolbar .sleeper-select",
          );
          const rect = (element: HTMLElement | null | undefined) =>
            element?.getBoundingClientRect();
          const viewport = document.documentElement.clientWidth;
          const audited = [
            document.querySelector<HTMLElement>(".players-toolbar"),
            document.querySelector<HTMLElement>(".result-list"),
            row,
          ].filter((element): element is HTMLElement => Boolean(element));
          return {
            viewport,
            rowHeight: rect(row)?.height ?? 0,
            avatar: [rect(avatar)?.width ?? 0, rect(avatar)?.height ?? 0],
            avatarFallback: fallback?.textContent.trim() ?? "",
            nameFont: name ? getComputedStyle(name).fontSize : "",
            metaFont: meta ? getComputedStyle(meta).fontSize : "",
            searchHeight: rect(search)?.height ?? 0,
            selectHeight: rect(select)?.height ?? 0,
            selectedState:
              document
                .querySelector<HTMLElement>(".result-list > button.selected")
                ?.getAttribute("aria-pressed") ?? null,
            clipsViewport: audited.some((element) => {
              const box = element.getBoundingClientRect();
              return box.left < -0.5 || box.right > viewport + 0.5;
            }),
          };
        });

        expect(layout.viewport).toBe(width);
        expect(layout.rowHeight).toBe(52);
        expect(layout.avatar).toEqual([32, 32]);
        expect(layout.avatarFallback.length).toBeGreaterThan(0);
        expect(layout.nameFont).toBe("12px");
        expect(layout.metaFont).toBe("9px");
        expect(layout.searchHeight).toBe(32);
        expect(layout.selectHeight).toBe(32);
        expect(layout.selectedState).toBe("true");
        expect(layout.clipsViewport).toBe(false);

        if (width === 320) {
          await testInfo.attach("players-320-density", {
            body: await page.screenshot({ animations: "disabled" }),
            contentType: "image/png",
          });
        }
      });
    }

    const search = page.getByRole("searchbox", { name: "Search players" });
    await search.focus();
    await expect(search).toBeFocused();
    expect(
      await search.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    ).toBe("2px");

    await search.fill("zzzzzz-no-player");
    await expect(
      page.getByText("No player found", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".player-profile")).toHaveCount(0);
    await search.fill("");
    await expect(page.locator(".result-list > button").first()).toBeVisible();
  } finally {
    await page.setViewportSize({ width: 400, height: 900 });
  }
});

test("matches measured Sleeper Team roster anatomy at every audit width", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  const { page, extensionId } = loaded;
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/team`);
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".roster-list").first()).toBeVisible();

  try {
    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await test.step(`${width}px Team workspace`, async () => {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => {
          const avatar = document.querySelector<HTMLElement>(
            ".roster-list .player-avatar",
          );
          const row = avatar?.closest<HTMLElement>(".sleeper-roster-slot");
          const slot = row?.querySelector<HTMLElement>(
            ".sleeper-roster-slot__label",
          );
          const name = row?.querySelector<HTMLElement>(
            ".sleeper-roster-slot__copy strong",
          );
          const meta = row?.querySelector<HTMLElement>(
            ".sleeper-roster-slot__copy small",
          );
          const rect = (element: HTMLElement | null | undefined) =>
            element?.getBoundingClientRect();
          const viewport = document.documentElement.clientWidth;
          const lists = [
            ...document.querySelectorAll<HTMLElement>(".roster-list"),
          ];
          const listItems = [
            ...document.querySelectorAll<HTMLElement>(
              '.roster-list > [role="listitem"]',
            ),
          ];
          const audited = [
            document.querySelector<HTMLElement>("main"),
            document.querySelector<HTMLElement>(".team-layout"),
            document.querySelector<HTMLElement>(".roster-card"),
            ...lists,
            row,
          ].filter((element): element is HTMLElement => Boolean(element));
          return {
            viewport,
            row: [rect(row)?.width ?? 0, rect(row)?.height ?? 0],
            slot: [rect(slot)?.width ?? 0, rect(slot)?.height ?? 0],
            avatar: [rect(avatar)?.width ?? 0, rect(avatar)?.height ?? 0],
            nameFont: name ? getComputedStyle(name).fontSize : "",
            metaFont: meta ? getComputedStyle(meta).fontSize : "",
            listCount: lists.length,
            listRolesValid: lists.every(
              (list) =>
                list.getAttribute("role") === "list" &&
                Boolean(list.getAttribute("aria-label")),
            ),
            itemRolesValid:
              listItems.length > 0 &&
              listItems.every(
                (item) => item.getAttribute("role") === "listitem",
              ),
            clipsViewport: audited.some((element) => {
              const box = element.getBoundingClientRect();
              return box.left < -0.5 || box.right > viewport + 0.5;
            }),
          };
        });

        expect(layout.viewport).toBe(width);
        expect(layout.row[1]).toBe(64);
        expect(layout.slot).toEqual([42, 32]);
        expect(layout.avatar).toEqual([32, 32]);
        expect(layout.nameFont).toBe("14px");
        expect(layout.metaFont).toBe("11px");
        expect(layout.listCount).toBeGreaterThan(0);
        expect(layout.listRolesValid).toBe(true);
        expect(layout.itemRolesValid).toBe(true);
        expect(layout.clipsViewport).toBe(false);

        if (width === 320) {
          await testInfo.attach("team-320-roster", {
            body: await page.screenshot({ animations: "disabled" }),
            contentType: "image/png",
          });
        }
      });
    }
  } finally {
    await page.setViewportSize({ width: 400, height: 900 });
  }
});

test("groups More and never strands a sub-screen", async () => {
  const { page } = loaded;
  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  await primaryNav.getByRole("link", { name: "More", exact: true }).click();

  // Grouped, not one flat list of 21 destinations.
  for (const group of [
    "This week",
    "Roster",
    "Drafts",
    "Leagues & data",
    "App",
  ]) {
    await expect(page.getByRole("navigation", { name: group })).toBeVisible();
  }

  // Search narrows the index.
  await page.getByPlaceholder("Search tools").fill("taxi");
  await expect(page.getByRole("navigation", { name: "Roster" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "This week" })).toHaveCount(
    0,
  );
  await page.getByPlaceholder("Search tools").fill("");

  // A More-level screen keeps More lit and always offers a way back.
  await page
    .getByRole("navigation", { name: "Roster" })
    .getByRole("link", { name: /Taxi Squad/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Taxi Squad", exact: true }),
  ).toBeVisible();
  await expect(
    primaryNav.getByRole("link", { name: "More", exact: true }),
  ).toHaveClass(/active/);

  const back = page.getByRole("button", { name: "Back to More" });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.getByRole("heading", { name: "More" })).toBeVisible();
});

/**
 * "Advanced" used to be where the cache controls, the log level and the
 * launcher position ended up because none of them named a home. Each section
 * now stands for one subject, so this walks every one of them to prove none
 * became a dead nav entry during the split.
 */
test("settings opens on getting started and every section renders", async () => {
  const { page } = loaded;
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`chrome-extension://${loaded.extensionId}/options.html`);
  await expect(
    page.getByRole("heading", { name: "Getting started", level: 1 }),
  ).toBeVisible();

  const sections = [
    "Getting started",
    "Sleeper account",
    "AI provider key",
    "Draft defaults",
    "Analysis",
    "Data & cache",
    "Import & export",
    "Appearance",
    "Accessibility",
    "Diagnostics",
    "Privacy",
    "About",
  ];
  for (const section of sections) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: section, level: 1 }),
    ).toBeVisible();
    // A section that renders no panel would leave the body empty.
    await expect(
      page.locator(".options-panel .section-header").first(),
    ).toBeVisible();
  }
});

test("exposes provider-neutral settings without requiring a key", async () => {
  const { page } = loaded;
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`chrome-extension://${loaded.extensionId}/options.html`);
  await page
    .getByRole("button", { name: "AI provider key", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bring your own AI provider key" }),
  ).toBeVisible();
  const provider = page.getByLabel("Provider");
  await expect(provider).toHaveValue("openai");
  await provider.selectOption("anthropic");
  await expect(provider).toHaveValue("anthropic");
  await expect(page.getByLabel("Anthropic API key")).toBeVisible();
  await expect(page.getByText("Session only", { exact: true })).toBeVisible();
});

test("recalculates strategy and supports draft decision interactions", async () => {
  const { page } = loaded;
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/draft`,
  );
  await page.locator(".draft-context-rail__settings > summary").click();
  await page.getByLabel("Strategy").selectOption("rebuild");
  await expect(page.getByLabel("Strategy")).toHaveValue("rebuild");
  await page.locator(".what-if > summary").click();
  await page.getByRole("button", { name: "Wait one round" }).click();
  await expect(page.getByText("Recalculate next-pick survival")).toBeVisible();
});

test("uses canonical player photos and exposes the on-clock AI switch", async () => {
  const { page, extensionId } = loaded;
  const previousStorage = await page.evaluate(async () => {
    const stored = await chrome.storage.local.get(["demoMode", "appSettings"]);
    return {
      demoMode: stored.demoMode ?? null,
      appSettings: stored.appSettings ?? null,
    };
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/draft`);
  await expect(
    page.locator(".draft-copilot__identity .player-avatar img"),
  ).toHaveAttribute(
    "src",
    "https://sleepercdn.com/content/nfl/players/11604.jpg",
  );

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      demoMode: { enabled: true, fixture: "big-bucks" },
      appSettings: {
        onboardingComplete: true,
        automaticAnalysis: true,
      },
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Draft Copilot", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "On-clock AI activity" }),
  ).toBeVisible();
  await expect(
    page.getByText("AI never submits a pick", { exact: false }),
  ).toBeVisible();

  const disableAi = page.getByRole("switch", { name: "Turn AI off" });
  await expect(disableAi).toHaveAttribute("aria-checked", "true");
  await disableAi.click();
  await expect(
    page.getByRole("switch", { name: "Turn AI on" }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByText(
      "Local recommendation is ready. Turn AI on for optional context.",
    ),
  ).toBeVisible();
  await page.evaluate(async (previous) => {
    for (const key of ["demoMode", "appSettings"] as const) {
      const value = previous[key];
      if (value === null) await chrome.storage.local.remove(key);
      else await chrome.storage.local.set({ [key]: value });
    }
  }, previousStorage);
});

test("completes a full league-derived mock with every pick entered manually", async () => {
  test.setTimeout(90_000);
  const manualLoaded = await loadExtension();
  const { context, page, extensionId } = manualLoaded;
  try {
    await installManualMockLeague(context);
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        appSettings: {
          onboardingComplete: true,
          sleeperUsername: "manual-draft-reviewer",
          sleeperUserId: "mock-user-1",
        },
      });
    });
    await page.goto(
      `chrome-extension://${extensionId}/sidepanel.html?fixture=manual-mock#/mock-draft`,
    );
    await expect(page.getByRole("heading", { name: "Mock Draft" })).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(
      page.getByText("Browser Manual Mock 2026").first(),
    ).toBeVisible();
    await expect(page.getByText("MOCK — NO SLEEPER WRITES")).toBeVisible();
    await expect(page.getByLabel("Enter every pick manually")).toBeChecked();
    await expect(page.getByText("Your Sleeper slot")).toBeVisible();
    await page
      .getByRole("button", { name: "Start local mock", exact: true })
      .click();

    const selectedNames = new Set<string>();
    for (let pick = 1; pick <= 48; pick += 1) {
      const topRecommendation = page
        .locator(".mock-player-list article")
        .first();
      await expect(topRecommendation).toBeVisible();
      const playerName = await topRecommendation.locator("span b").innerText();
      expect(selectedNames.has(playerName)).toBe(false);
      selectedNames.add(playerName);
      await topRecommendation
        .getByRole("button", { name: "Record pick", exact: true })
        .click();
      await expect(page.locator(".mock-validation")).toContainText(
        `${pick} legal picks`,
      );
      await expect(
        page
          .locator(".mock-pick-history")
          .getByText(playerName, { exact: true }),
      ).toBeVisible();
    }

    expect(selectedNames.size).toBe(48);
    await expect(page.getByText("Complete", { exact: true })).toBeVisible();
    await expect(
      page.getByText("48 picks recorded", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".mock-validation")).toContainText(
      "48 legal picks · exact order, ownership, eligibility, pool, limits, and duplicates checked",
    );
    await expect(page.getByText("Traded", { exact: true })).toBeVisible();
    await expect(page.getByText(/auto-?pick/i)).toHaveCount(0);
    if (process.env.CAPTURE_QA === "1") {
      await page.screenshot({
        path: "artifacts/mock-draft-48-pick-validation.png",
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await manualLoaded.context.close();
  }
});

test("stays usable offline with local demo and cache-first features", async () => {
  const { page, context } = loaded;
  await context.setOffline(true);
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/rankings`,
  );
  await expect(page.getByRole("heading", { name: "Rankings" })).toBeVisible();
  await expect(page.locator(".ranking-table")).toBeVisible();
  await context.setOffline(false);
});

test("has no serious automated accessibility violations", async () => {
  const { page } = loaded;
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/draft`,
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("renders the Draft workspace across every required audit width", async () => {
  const { page } = loaded;
  const testInfo = test.info();
  const previousStorage = await page.evaluate(async () => {
    const stored = await chrome.storage.local.get(["demoMode", "appSettings"]);
    const settings =
      stored.appSettings && typeof stored.appSettings === "object"
        ? stored.appSettings
        : {};
    await chrome.storage.local.set({
      demoMode: { enabled: true, fixture: "big-bucks" },
      appSettings: {
        ...settings,
        onboardingComplete: true,
        automaticAnalysis: false,
      },
    });
    return {
      demoMode: stored.demoMode ?? null,
      appSettings: stored.appSettings ?? null,
    };
  });

  try {
    await page.goto(
      `chrome-extension://${loaded.extensionId}/sidepanel.html#/draft`,
    );
    await page.reload();

    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await test.step(`${width}px Draft workspace`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(async () => {
          await chrome.storage.local.set({
            demoMode: { enabled: true, fixture: "big-bucks" },
          });
        });
        await page.reload();
        await expect(
          page.getByRole("button", { name: /Demo · Big Bucks Mock/ }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Draft Copilot", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("switch", { name: "Turn AI on" }),
        ).toBeVisible();
        await expect(
          page.getByRole("list", { name: "On-clock AI activity" }),
        ).toBeVisible();
        await expect(page.locator(".recommendation-board")).toBeVisible();

        const layout = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          const coreSelectors = [
            ".primary-navigation",
            ".draft-context-rail",
            ".draft-copilot",
            ".recommendation-board",
            ".draft-copilot__turn-ai-toggle",
          ];
          const core = coreSelectors.map((selector) => {
            const element = document.querySelector<HTMLElement>(selector);
            const rect = element?.getBoundingClientRect();
            return {
              selector,
              present: Boolean(element),
              left: rect ? Math.round(rect.left) : null,
              right: rect ? Math.round(rect.right) : null,
              width: rect ? Math.round(rect.width) : null,
              height: rect ? Math.round(rect.height) : null,
            };
          });
          const accidentalOverflow = [
            ...document.querySelectorAll<HTMLElement>("body *"),
          ]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              if (!(rect.right > viewport + 0.5 || rect.left < -0.5))
                return false;
              let parent = element.parentElement;
              while (parent) {
                const overflowX = getComputedStyle(parent).overflowX;
                if (overflowX === "auto" || overflowX === "scroll")
                  return false;
                parent = parent.parentElement;
              }
              return true;
            })
            .map((element) => ({
              element: `${element.tagName.toLowerCase()}.${element.className}`,
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
              scrollWidth: element.scrollWidth,
            }))
            .slice(0, 20);
          const criticalText = [
            ".draft-copilot__name h1",
            ".draft-copilot__turn-ai-status small",
            ".draft-copilot__turn-ai-boundary",
            ".recommendation-row__main .sleeper-player-identity__copy strong",
          ].map((selector) => {
            const element = document.querySelector<HTMLElement>(selector);
            const computed = element ? getComputedStyle(element) : null;
            return {
              selector,
              text: element?.innerText ?? null,
              clientWidth: element?.clientWidth ?? null,
              scrollWidth: element?.scrollWidth ?? null,
              clientHeight: element?.clientHeight ?? null,
              scrollHeight: element?.scrollHeight ?? null,
              overflow: computed?.overflow ?? null,
              overflowX: computed?.overflowX ?? null,
              overflowY: computed?.overflowY ?? null,
              textOverflow: computed?.textOverflow ?? null,
              whiteSpace: computed?.whiteSpace ?? null,
              clipped: element
                ? (element.scrollWidth > element.clientWidth + 1 &&
                    computed?.overflowX !== "visible") ||
                  (element.scrollHeight > element.clientHeight + 1 &&
                    computed?.overflowY !== "visible")
                : null,
            };
          });
          const typography = [
            {
              role: "recommendation player name",
              selector:
                ".recommendation-row__main .sleeper-player-identity__copy strong",
              minimum: 14,
            },
            {
              role: "recommendation player metadata",
              selector:
                ".recommendation-row__main .sleeper-player-identity__copy small",
              minimum: 10,
            },
            {
              role: "position filter",
              selector: ".position-filters button",
              minimum: 10,
            },
            {
              role: "recommendation table heading",
              selector: ".player-table-head",
              minimum: 10,
            },
            {
              role: "on-clock AI activity",
              selector: ".draft-copilot__turn-ai-status small",
              minimum: 10,
            },
            {
              role: "on-clock AI step",
              selector: ".draft-copilot__turn-ai-steps li",
              minimum: 10,
            },
            {
              role: "on-clock safety boundary",
              selector: ".draft-copilot__turn-ai-boundary",
              minimum: 10,
            },
          ].map(({ role, selector, minimum }) => {
            const element = document.querySelector<HTMLElement>(selector);
            return {
              role,
              selector,
              minimum,
              present: Boolean(element),
              actual: element
                ? Number.parseFloat(getComputedStyle(element).fontSize)
                : null,
            };
          });
          const firstRecommendation = document.querySelector<HTMLElement>(
            ".recommendation-row__main",
          );
          const recommendationMeta = firstRecommendation?.querySelector(
            ".sleeper-player-identity__copy small",
          );
          const recommendationPosition =
            firstRecommendation?.querySelector(".position-badge");
          const metaDisplay = recommendationMeta
            ? getComputedStyle(recommendationMeta).display
            : null;
          const positionDisplay = recommendationPosition
            ? getComputedStyle(recommendationPosition).display
            : null;
          const positionText = recommendationPosition?.textContent.trim() ?? "";
          const metaText = recommendationMeta?.textContent.trim() ?? "";
          return {
            viewport,
            documentScrollWidth: document.documentElement.scrollWidth,
            core,
            accidentalOverflow,
            criticalText,
            typography,
            firstRecommendationPosition: {
              present: Boolean(firstRecommendation),
              positionText,
              positionDisplay,
              metaText,
              metaDisplay,
              visible:
                (positionDisplay !== "none" && positionText.length > 0) ||
                (metaDisplay !== "none" &&
                  positionText.length > 0 &&
                  metaText
                    .split("·")
                    .map((part) => part.trim())
                    .includes(positionText)),
            },
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
              entry.left < -0.5 ||
              entry.right > width + 0.5,
          ),
        ).toEqual([]);
        expect(layout.criticalText).toEqual(
          layout.criticalText.map((entry) => ({ ...entry, clipped: false })),
        );
        expect(
          layout.typography.filter(
            (entry) =>
              !entry.present ||
              entry.actual === null ||
              entry.actual < entry.minimum,
          ),
        ).toEqual([]);
        expect(layout.firstRecommendationPosition).toMatchObject({
          present: true,
          visible: true,
        });

        if (width === 390) {
          await page
            .getByText("More draft intelligence", { exact: true })
            .click();
          await expect(
            page.getByText("Why now", { exact: true }),
          ).toBeVisible();
        }

        await testInfo.attach(`draft-${width}x900`, {
          body: await page.screenshot({ animations: "disabled" }),
          contentType: "image/png",
        });

        if (width === 320) {
          const firstRecommendation = page
            .locator(".recommendation-row__main")
            .first();
          await firstRecommendation.scrollIntoViewIfNeeded();
          await testInfo.attach("draft-320-recommendation-position", {
            body: await firstRecommendation.screenshot({
              animations: "disabled",
            }),
            contentType: "image/png",
          });
        }

        if (width === 390) {
          await page
            .getByText("More draft intelligence", { exact: true })
            .click();
        }
      });
    }
  } finally {
    await page.evaluate(async (previous) => {
      for (const key of ["demoMode", "appSettings"] as const) {
        const value = previous[key];
        if (value === null) await chrome.storage.local.remove(key);
        else await chrome.storage.local.set({ [key]: value });
      }
    }, previousStorage);
    await page.setViewportSize({ width: 420, height: 900 });
  }
});

test("propagates a Sleeper route and never disguises a live error as demo data", async () => {
  const { context, page, extensionId } = loaded;
  const draftId = "integration-draft-1234";
  await context.route("https://sleeper.com/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body><main><h1>Sleeper draft fixture</h1></main></body></html>",
    });
  });
  const sleeperPage = await context.newPage();
  await sleeperPage.goto(`https://sleeper.com/draft/nfl/${draftId}`);
  await expect(
    sleeperPage.getByRole("button", {
      name: "Open Not Sleeping side panel",
    }),
  ).toBeVisible();

  const sleeperTabId = await page.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "https://sleeper.com/*" });
    return tabs.find((tab) => tab.id !== undefined)?.id;
  });
  expect(sleeperTabId).toBeDefined();
  const contextKey = `currentSleeperContext:${String(sleeperTabId)}`;

  await page.setViewportSize({ width: 420, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(async (key) => {
        const stored = await chrome.storage.session.get(key);
        const route = stored[key] as { draftId?: string } | undefined;
        return route?.draftId;
      }, contextKey),
    )
    .toBe(draftId);
  const runtimeStatus = await page.evaluate(async (tabId) => {
    const result: unknown = await chrome.runtime.sendMessage({
      v: 1,
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "GET_STATUS",
      payload: { tabId },
    });
    return result;
  }, sleeperTabId);
  if (
    !runtimeStatus ||
    typeof runtimeStatus !== "object" ||
    !("ok" in runtimeStatus) ||
    runtimeStatus.ok !== true
  ) {
    throw new Error(JSON.stringify(runtimeStatus));
  }
  expect(runtimeStatus).toMatchObject({
    ok: true,
    data: {
      context: { supported: true, draftId },
      demo: { enabled: false },
    },
  });
  await page.goto(
    `chrome-extension://${extensionId}/sidepanel.html?context=${draftId}#/draft`,
  );
  await expect(
    page.getByRole("heading", { name: "Live draft unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Retry needed").first()).toBeVisible();
  await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Malik Nabers" })).toHaveCount(
    0,
  );

  await sleeperPage.close();
  await context.unrouteAll({ behavior: "wait" });
});

async function installManualMockLeague(context: LoadedExtension["context"]) {
  const teams = 16;
  const users = Array.from({ length: teams }, (_, index) => ({
    user_id: `mock-user-${index + 1}`,
    username: `mock-manager-${index + 1}`,
    display_name:
      index === 0 ? "Manual Draft Reviewer" : `Manager ${index + 1}`,
    avatar: null,
    metadata: { team_name: index === 0 ? "Night Shift" : `Team ${index + 1}` },
  }));
  const rosters = users.map((user, index) => ({
    roster_id: index + 1,
    owner_id: user.user_id,
    league_id: "manual-mock-league",
    players: [`veteran-${index + 1}`],
    starters: [`veteran-${index + 1}`],
    reserve: [],
    taxi: [],
    settings: {},
    metadata: {},
  }));
  const positionPattern = ["QB", "RB", "WR", "WR", "TE"];
  const players = Object.fromEntries(
    Array.from({ length: 80 }, (_, index) => {
      const id = `rookie-${index + 1}`;
      const position = positionPattern[index % positionPattern.length] ?? "WR";
      return [
        id,
        {
          player_id: id,
          first_name: "Rookie",
          last_name: String(index + 1),
          full_name: `Rookie ${index + 1}`,
          position,
          fantasy_positions: [position],
          team: ["BUF", "KC", "PHI", "DET"][index % 4],
          age: 21,
          years_exp: 0,
          status: "active",
          injury_status: null,
          college: `College ${index + 1}`,
          search_rank: index + 1,
          metadata: { rookie_year: "2026" },
        },
      ];
    }),
  );
  const league = {
    league_id: "manual-mock-league",
    name: "Browser Manual Mock 2026",
    season: "2026",
    sport: "nfl",
    status: "pre_draft",
    total_rosters: teams,
    draft_id: "manual-mock-draft",
    avatar: null,
    previous_league_id: null,
    settings: { type: 2, taxi_slots: 3, reserve_slots: 2 },
    scoring_settings: { pass_td: 4, rec: 1, bonus_rec_te: 0.5 },
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
      "BN",
      "BN",
      "TAXI",
    ],
    metadata: {},
  };
  const draft = {
    draft_id: "manual-mock-draft",
    league_id: league.league_id,
    type: "linear",
    status: "pre_draft",
    season: "2026",
    sport: "nfl",
    settings: { teams, rounds: 3, player_type: 1 },
    metadata: { name: "2026 Rookie Draft", player_pool: "rookies" },
    draft_order: Object.fromEntries(
      users.map((user, index) => [user.user_id, index + 1]),
    ),
    slot_to_roster_id: Object.fromEntries(
      users.map((_, index) => [String(index + 1), index + 1]),
    ),
    creators: ["mock-user-1"],
  };
  const tradedPicks = [
    {
      season: "2026",
      round: 2,
      roster_id: 5,
      previous_owner_id: 5,
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
    const request = route.request();
    if (request.method() !== "GET") {
      await route.fulfill({ status: 405, body: "GET only" });
      return;
    }
    const path = new URL(request.url()).pathname.replace(/^\/v1/, "");
    let body: unknown = [];
    if (path === "/state/nfl") body = nflState;
    else if (path === "/user/mock-user-1/leagues/nfl/2026") body = [league];
    else if (path.startsWith("/user/mock-user-1/leagues/nfl/")) body = [];
    else if (path === `/league/${league.league_id}`) body = league;
    else if (path === `/league/${league.league_id}/users`) body = users;
    else if (path === `/league/${league.league_id}/rosters`) body = rosters;
    else if (path === `/league/${league.league_id}/drafts`) body = [draft];
    else if (path === `/league/${league.league_id}/traded_picks`)
      body = tradedPicks;
    else if (path === "/players/nfl") body = players;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
