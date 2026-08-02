import { describe, expect, it, vi } from "vitest";

import {
  createMessage,
  validateMessage,
  validateSender,
} from "@/services/messaging/protocol";
import {
  observeSleeperNavigation,
  parseSleeperRoute,
} from "@/services/context/route-detection";
import {
  RequestQueue,
  stableContentHash,
} from "@/services/research/request-queue";

describe("Sleeper route context", () => {
  it.each([
    ["https://sleeper.com/draft/nfl/123456", "draft", "123456"],
    ["https://sleeper.com/leagues/987654/matchup", "matchup", undefined],
    ["https://sleeper.com/leagues/987654/team", "team", undefined],
    ["https://sleeper.com/leagues/987654/players", "players", undefined],
    ["https://sleeper.com/leagues/987654", "league", undefined],
  ])("parses %s", (url, route, draftId) => {
    expect(parseSleeperRoute(url)).toMatchObject({
      supported: true,
      route,
      ...(draftId ? { draftId } : {}),
    });
  });

  it("rejects non-Sleeper, insecure, invalid, and suspicious identifiers", () => {
    expect(parseSleeperRoute("not a url").supported).toBe(false);
    expect(
      parseSleeperRoute("http://sleeper.com/draft/nfl/1234").supported,
    ).toBe(false);
    expect(
      parseSleeperRoute("https://evil.example/draft/nfl/1234").supported,
    ).toBe(false);
    expect(parseSleeperRoute("https://sleeper.com/draft/nfl/x").route).toBe(
      "home",
    );
  });

  it("observes history navigation and restores patched methods", async () => {
    history.replaceState({}, "", "/");
    const originalPush = history.pushState;
    const onChange = vi.fn();
    const dispose = observeSleeperNavigation(onChange);
    history.pushState({}, "", "/draft/nfl/123456");
    await Promise.resolve();
    expect(onChange).toHaveBeenCalled();
    dispose();
    expect(history.pushState).toBe(originalPush);
  });
});

describe("runtime protocol", () => {
  it("creates and validates bounded versioned messages", () => {
    const message = createMessage({ type: "GET_STATUS", payload: {} });
    expect(validateMessage(message)).toEqual(message);
    expect(message.v).toBe(1);
  });

  it("rejects stale, oversized, and credential-bearing requests", () => {
    const stale = createMessage({ type: "GET_CONTEXT", payload: {} });
    expect(() =>
      validateMessage(stale, stale.timestamp + 3 * 60_000),
    ).toThrow();
    const oversized = { ...stale, payload: { value: "x".repeat(70_000) } };
    expect(() => validateMessage(oversized)).toThrow("too large");
    const credential = { ...stale, payload: { apiKey: "sk-abcdefghijklmnop" } };
    expect(() => validateMessage(credential)).toThrow("Credentials");
  });

  it("enforces extension and content-script sender capabilities", () => {
    const status = createMessage({ type: "GET_STATUS", payload: {} });
    expect(() =>
      validateSender(
        {
          id: chrome.runtime.id,
          url: `chrome-extension://${chrome.runtime.id}/sidepanel.html`,
        },
        status,
      ),
    ).not.toThrow();
    expect(() =>
      validateSender(
        {
          id: chrome.runtime.id,
          tab: { id: 1 } as chrome.tabs.Tab,
          url: `chrome-extension://${chrome.runtime.id}/sidepanel.html`,
        },
        status,
      ),
    ).not.toThrow();
    expect(() => validateSender({ id: "foreign" }, status)).toThrow();
    const content = createMessage({ type: "OPEN_SIDE_PANEL", payload: {} });
    expect(() =>
      validateSender(
        {
          id: chrome.runtime.id,
          tab: { id: 1 } as chrome.tabs.Tab,
          url: "https://sleeper.com/leagues/1234",
        },
        content,
      ),
    ).not.toThrow();
    expect(() =>
      validateSender(
        {
          id: chrome.runtime.id,
          tab: { id: 1 } as chrome.tabs.Tab,
          url: "https://evil.example",
        },
        content,
      ),
    ).toThrow();
  });
});

describe("request queue", () => {
  it("deduplicates queued and active work", async () => {
    const queue = new RequestQueue({ requestsPerMinute: 12, concurrency: 1 });
    let release: ((value: string) => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const first = queue.enqueue("same", run);
    const second = queue.enqueue("same", run);
    expect(run).toHaveBeenCalledTimes(1);
    release?.("done");
    await expect(first).resolves.toBe("done");
    await expect(second).resolves.toBe("done");
    expect(queue.size).toBe(0);
  });

  it("cancels queued and active requests", async () => {
    const queue = new RequestQueue({ requestsPerMinute: 12, concurrency: 1 });
    const active = queue.enqueue(
      "active",
      (signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const queued = queue.enqueue("queued", async () => "queued");
    expect(queue.cancel("queued")).toBe(true);
    await expect(queued).rejects.toMatchObject({ code: "CANCELLED" });
    expect(queue.cancel("active")).toBe(true);
    await expect(active).rejects.toThrow("aborted");
    expect(queue.cancel("missing")).toBe(false);
  });

  it("cancels all queued work and exposes bounded configuration", async () => {
    const queue = new RequestQueue({
      requestsPerMinute: 99,
      concurrency: 99,
      hardConcurrencyCeiling: 1,
    });
    const active = queue.enqueue(
      "first",
      (signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new Error("first aborted")),
          ),
        ),
    );
    const queued = queue.enqueue("second", async () => "second");
    expect(queue.size).toBe(2);
    queue.configure({ requestsPerMinute: 1, concurrency: 1 });
    queue.cancelAll();
    await expect(active).rejects.toThrow("first aborted");
    await expect(queued).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("produces stable order-independent object hashes", () => {
    expect(stableContentHash({ a: 1, b: [2, 3] })).toBe(
      stableContentHash({ b: [2, 3], a: 1 }),
    );
    expect(stableContentHash({ a: 2 })).not.toBe(stableContentHash({ a: 1 }));
  });
});
