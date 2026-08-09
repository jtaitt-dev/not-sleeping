import { expect, test } from "@playwright/test";

import { loadExtension, type LoadedExtension } from "./extension-fixture";

let loaded: LoadedExtension;

test.beforeAll(async () => {
  loaded = await loadExtension();
});

test.afterAll(async () => {
  await loaded.context.close();
});

test("requires both gates before exposing manual-odds research", async () => {
  const { page, extensionId } = loaded;
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/more`);
  await expect(
    page.getByRole("link", { name: "Advanced Research" }),
  ).toHaveCount(0);
  await page.goto(
    `chrome-extension://${extensionId}/sidepanel.html#/advanced-research`,
  );
  await expect(
    page.getByRole("heading", { name: "Explicit opt-in required" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  const enableToggle = page.getByLabel("Show advanced research tools");
  await expect(enableToggle).toBeDisabled();
  await page
    .getByLabel(/I understand that advanced research is informational only/)
    .check();
  await expect(enableToggle).toBeEnabled();
  await enableToggle.check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");

  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html#/more`);
  const researchLink = page.getByRole("link", { name: "Advanced Research" });
  await expect(researchLink).toBeVisible();
  await researchLink.click();

  await expect(
    page.getByRole("heading", { name: "Manual Odds Research" }),
  ).toBeVisible();
  await expect(
    page.getByText("Responsible-use opt-in", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("uncertain entertainment analysis", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Disable manual odds research permanently",
    }),
  ).toBeVisible();

  await page.getByLabel("I affirm that I am 21 years of age or older.").check();
  await page
    .getByLabel(
      "I am responsible for checking and following the law where I am located.",
    )
    .click();

  await expect(
    page.getByText(/fails closed until it can verify a legal player pool/i),
  ).toBeVisible();
  await expect(page.getByLabel("Player or leg label")).toHaveCount(0);
  await expect(
    page.locator('input[name*="stake" i], input[aria-label*="stake" i]'),
  ).toHaveCount(0);
  await expect(
    page.locator('a[href*="sportsbook"], a[href*="bet"]'),
  ).toHaveCount(0);
  await expect(page.getByText(/financial advice/i)).toBeVisible();
});
