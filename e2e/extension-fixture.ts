import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export type LoadedExtension = {
  context: BrowserContext;
  page: Page;
  extensionId: string;
};

export async function loadExtension(): Promise<LoadedExtension> {
  const extensionPath = resolve(import.meta.dirname, "..", "dist");
  const profile = await mkdtemp(resolve(tmpdir(), "not-sleeping-e2e-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 420, height: 900 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  return { context, page, extensionId };
}
