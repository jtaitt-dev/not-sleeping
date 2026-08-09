import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { loadExtension } from "./extension-fixture";

const liveAuditEnabled = process.env.RUN_LIVE_SLEEPER_E2E === "1";
const accountName = process.env.SLEEPER_E2E_USERNAME?.trim() ?? "";
const leagueName = process.env.SLEEPER_E2E_LEAGUE_NAME?.trim() ?? "";

test.skip(!liveAuditEnabled, "Live Sleeper extension audit is opt-in.");

test("completes a real league-derived mock through manual side-panel interactions", async () => {
  test.setTimeout(180_000);
  if (!accountName || !leagueName) {
    throw new Error(
      "SLEEPER_E2E_USERNAME and SLEEPER_E2E_LEAGUE_NAME are required when RUN_LIVE_SLEEPER_E2E=1.",
    );
  }

  const userResponse = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(accountName)}`,
  );
  expect(userResponse.ok).toBe(true);
  const user = (await userResponse.json()) as { user_id?: unknown };
  expect(typeof user.user_id).toBe("string");
  const userId = user.user_id as string;

  const loaded = await loadExtension();
  const { context, extensionId, page } = loaded;
  const sleeperWriteAttempts: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await context.route("https://api.sleeper.app/**", async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        sleeperWriteAttempts.push(`${request.method()} ${request.url()}`);
        await route.fulfill({ status: 405, body: "GET only" });
        return;
      }
      await route.continue();
    });
    await page.evaluate(
      async ({ sleeperUsername, sleeperUserId }) => {
        await chrome.storage.local.set({
          appSettings: {
            onboardingComplete: true,
            sleeperUsername,
            sleeperUserId,
          },
        });
      },
      { sleeperUsername: accountName, sleeperUserId: userId },
    );
    await page.reload();

    const leagueSwitcher = page.locator(".league-switcher-trigger");
    await expect(leagueSwitcher).not.toContainText("Choose a league", {
      timeout: 60_000,
    });
    await expect(page.getByText("League live", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    if (!(await leagueSwitcher.innerText()).includes(leagueName)) {
      await leagueSwitcher.click();
      const switcher = page.getByRole("dialog", { name: "Switch league" });
      await expect(
        switcher.getByText(/[1-9]\d* leagues available/),
      ).toBeVisible({ timeout: 60_000 });
      await switcher
        .getByPlaceholder("Search league, season, or ID")
        .fill(leagueName);
      const leagueOption = switcher
        .locator(".league-option")
        .filter({ hasText: leagueName })
        .getByRole("button")
        .first();
      await expect(leagueOption).toBeVisible();
      await leagueOption.dispatchEvent("click");
    }
    await expect(leagueSwitcher).toContainText(leagueName, {
      timeout: 60_000,
    });

    await page.goto(
      `chrome-extension://${extensionId}/sidepanel.html#/mock-draft`,
    );
    await expect(page.getByRole("heading", { name: "Mock Draft" })).toBeVisible(
      { timeout: 60_000 },
    );
    await expect(
      page.getByText(leagueName, { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("MOCK — NO SLEEPER WRITES")).toBeVisible();
    await expect(page.getByLabel("Enter every pick manually")).toBeChecked();
    const facts = page.getByLabel("Draft facts");
    await expect(
      facts.locator(".mock-fact").filter({ hasText: "Teams" }),
    ).toContainText("16");
    await expect(
      facts.locator(".mock-fact").filter({ hasText: "Rounds" }),
    ).toContainText("3");
    await expect(
      facts.locator(".mock-fact").filter({ hasText: "Pool" }),
    ).toContainText("rookies only");
    await expect(
      facts.locator(".mock-fact").filter({ hasText: "Traded picks" }),
    ).toContainText("8");
    const startButton = page.getByRole("button", {
      name: "Start local mock",
      exact: true,
    });
    if (!(await startButton.isEnabled())) {
      const poolProbe = await page.evaluate(
        () =>
          new Promise<unknown>((resolveProbe) => {
            chrome.runtime.sendMessage(
              {
                v: 1,
                requestId: crypto.randomUUID(),
                timestamp: Date.now(),
                type: "GET_PLAYER_POOL",
                payload: { limit: 168, rookiesOnly: true, idpOnly: false },
              },
              resolveProbe,
            );
          }),
      );
      throw new Error(
        `Live player pool did not become available: ${JSON.stringify(poolProbe)}`,
      );
    }
    await expect(startButton).toBeEnabled();
    await startButton.dispatchEvent("click");

    const selectedNames = new Set<string>();
    for (let pick = 1; pick <= 48; pick += 1) {
      const topRecommendation = page
        .locator(".mock-player-list article")
        .first();
      await expect(topRecommendation).toBeVisible();
      const playerName = await topRecommendation.locator("span b").innerText();
      expect(selectedNames.has(playerName)).toBe(false);
      selectedNames.add(playerName);
      const recordPick = topRecommendation.getByRole("button", {
        name: "Record pick",
        exact: true,
      });
      await expect(recordPick).toBeEnabled();
      await recordPick.dispatchEvent("click");
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
    await expect(page.getByText("Traded", { exact: true })).toHaveCount(8);
    await expect(page.getByText(/auto-?pick/i)).toHaveCount(0);
    expect(sleeperWriteAttempts).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    if (process.env.CAPTURE_QA === "1") {
      const screenshotPath = resolve(
        process.cwd(),
        "artifacts",
        "big-bucks-live-48-pick-validation.png",
      );
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await context.close();
  }
});
