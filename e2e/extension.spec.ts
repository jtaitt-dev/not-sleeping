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
    { link: "Draft", heading: "Best contextual fits" },
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

  await expect(page.getByRole("link", { name: "Labs" })).toHaveCount(0);
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/labs`,
  );
  await expect(page).toHaveURL(/#\/today$/);
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
  await page.getByLabel("Strategy").selectOption("rebuild");
  await expect(page.getByLabel("Strategy")).toHaveValue("rebuild");
  await page.getByRole("tab", { name: "Simulator" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Explore without changing the live board",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Wait one round" }).click();
  await expect(page.getByText("Recalculate availability")).toBeVisible();
});

test("completes a full mock with every user pick selected manually and validated", async () => {
  const { page } = loaded;
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/mock-draft`,
  );
  await expect(
    page.getByRole("heading", { name: "Mock Draft Lab" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  for (let userPick = 1; userPick <= 15; userPick += 1) {
    await expect(
      page.getByText("Your manual pick", { exact: true }),
    ).toBeVisible();
    const recommendations = page.locator(".mock-recommendations > div");
    await expect(recommendations).toHaveCount(8);
    const topRecommendation = recommendations.first();
    const playerName = await topRecommendation.locator("span b").innerText();
    await topRecommendation
      .getByRole("button", { name: "Draft", exact: true })
      .click();
    await expect(
      page.locator(".mock-board").getByText(playerName, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText("legal picks");
  }

  await expect(page.getByText("complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "150 legal picks · no duplicates · player pool and order verified",
  );
  await expect(page.getByText("AUTO-PICK", { exact: true })).toHaveCount(0);
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

test("renders at the 320px minimum without horizontal overflow", async () => {
  const { page } = loaded;
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/draft`,
  );
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
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

  await page.setViewportSize({ width: 420, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const stored = await chrome.storage.session.get(
          "currentSleeperContext",
        );
        const route = stored["currentSleeperContext"] as
          { draftId?: string } | undefined;
        return route?.draftId;
      }),
    )
    .toBe(draftId);
  const runtimeStatus = await page.evaluate(async () => {
    const result: unknown = await chrome.runtime.sendMessage({
      v: 1,
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "GET_STATUS",
      payload: {},
    });
    return result;
  });
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
