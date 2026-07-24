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
  await expect(
    page.getByRole("heading", { name: "Malik Nabers" }),
  ).toBeVisible();
  for (const workspace of [
    "Players",
    "Team",
    "Dynasty",
    "Trade",
    "Watchlist",
    "More",
  ]) {
    await page.getByRole("link", { name: workspace, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: workspace, exact: true }),
    ).toBeVisible();
  }
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
