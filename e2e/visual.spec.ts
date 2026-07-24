import { expect, test } from "@playwright/test";

import { loadExtension, type LoadedExtension } from "./extension-fixture";

let loaded: LoadedExtension;

test.beforeAll(async () => {
  loaded = await loadExtension();
});

test.afterAll(async () => {
  await loaded.context.close();
});

test("live draft workspace visual baseline", async () => {
  const { page } = loaded;
  await page.goto(
    `chrome-extension://${loaded.extensionId}/sidepanel.html#/draft`,
  );
  await expect(
    page.getByRole("heading", { name: "Malik Nabers" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("live-draft-workspace.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.015,
  });
});

test("secure options visual baseline", async () => {
  const { page } = loaded;
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`chrome-extension://${loaded.extensionId}/options.html`);
  await page.getByRole("button", { name: "OpenAI key", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bring your own OpenAI key" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("secure-key-settings.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.015,
  });
});
