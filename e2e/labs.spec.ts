import { expect, test } from "@playwright/test";

import { loadExtension, type LoadedExtension } from "./extension-fixture";

let loaded: LoadedExtension;

test.beforeAll(async () => {
  loaded = await loadExtension("labs");
});

test.afterAll(async () => {
  await loaded.context.close();
});

test("gates the Labs-only manual parlay research surface", async () => {
  const { page, extensionId } = loaded;
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/more`);
  const labsLink = page.getByRole("link", { name: "Labs" });
  await expect(labsLink).toBeVisible();
  await labsLink.click();

  await expect(page.getByRole("heading", { name: "Parlay Lab" })).toBeVisible();
  await expect(page.getByText("Labs opt-in", { exact: true })).toBeVisible();
  await expect(
    page.getByText("uncertain entertainment analysis", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Disable Parlay Lab permanently" }),
  ).toBeVisible();

  await page.getByLabel("I affirm that I am 21 years of age or older.").check();
  await page
    .getByLabel(
      "I am responsible for checking and following the law where I am located.",
    )
    .click();

  await expect(
    page.getByText("Prop Research Watchlist", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Player or leg label")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Start 24-hour cooldown" }),
  ).toBeVisible();
  await expect(
    page.locator('input[name*="stake" i], input[aria-label*="stake" i]'),
  ).toHaveCount(0);
  await expect(
    page.locator('a[href*="sportsbook"], a[href*="bet"]'),
  ).toHaveCount(0);
});
