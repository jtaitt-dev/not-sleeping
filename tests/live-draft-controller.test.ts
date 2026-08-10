import { describe, expect, it, vi } from "vitest";

import { LiveDraftController } from "@/services/context/live-draft-controller";
import type { LiveDraftState } from "@/types/domain";

describe("LiveDraftController", () => {
  it("switches drafts while the previous refresh is still in flight", async () => {
    const oldDraft = deferred<LiveDraftState>();
    const newDraft = deferred<LiveDraftState>();
    const loadDraft = vi.fn((draftId: string) =>
      draftId === "old-draft" ? oldDraft.promise : newDraft.promise,
    );
    const postMessage = vi.fn();
    let disconnect: (() => void) | undefined;
    let receive: ((message: unknown) => void) | undefined;
    const port = {
      name: "not-sleeping-live",
      sender: {
        id: "not-sleeping-test",
        url: "chrome-extension://not-sleeping-test/sidepanel.html",
      },
      postMessage,
      disconnect: vi.fn(),
      onMessage: {
        addListener: vi.fn((listener: (message: unknown) => void) => {
          receive = listener;
        }),
      },
      onDisconnect: {
        addListener: vi.fn((listener: () => void) => {
          disconnect = listener;
        }),
      },
    } as unknown as chrome.runtime.Port;
    const controller = new LiveDraftController(loadDraft, async () => ({}));

    controller.connect(port);
    receive?.({ type: "SUBSCRIBE", tabId: 7 });
    await Promise.resolve();
    controller.updateContext(7, { draftId: "old-draft" });
    controller.updateContext(7, { draftId: "new-draft" });

    expect(loadDraft).toHaveBeenCalledWith("old-draft", 7);
    expect(loadDraft).toHaveBeenCalledWith("new-draft", 7);

    newDraft.resolve(liveState("new-draft", "drafting"));
    await newDraft.promise;
    await Promise.resolve();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DRAFT_REFRESH",
        data: expect.objectContaining({
          context: expect.objectContaining({ draftId: "new-draft" }),
        }),
      }),
    );

    oldDraft.resolve(liveState("old-draft", "complete"));
    await oldDraft.promise;
    await Promise.resolve();
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          context: expect.objectContaining({ draftId: "old-draft" }),
        }),
      }),
    );

    disconnect?.();
  });

  it("never broadcasts one Sleeper tab's draft state to another tab", async () => {
    const loadDraft = vi.fn(async (draftId: string) =>
      liveState(draftId, "complete"),
    );
    const first = testPort();
    const second = testPort();
    const controller = new LiveDraftController(loadDraft, async () => ({}));

    controller.connect(first.port);
    controller.connect(second.port);
    first.receive({ type: "SUBSCRIBE", tabId: 7 });
    second.receive({ type: "SUBSCRIBE", tabId: 8 });
    await Promise.resolve();

    controller.updateContext(7, { draftId: "draft-a", status: "complete" });
    controller.updateContext(8, { draftId: "draft-b", status: "complete" });

    await vi.waitFor(() => {
      expect(first.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 7,
          draftId: "draft-a",
        }),
      );
      expect(second.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 8,
          draftId: "draft-b",
        }),
      );
    });
    expect(first.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ draftId: "draft-b" }),
    );
    expect(second.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ draftId: "draft-a" }),
    );
  });

  it("notifies only the side panel bound to the detected account tab", async () => {
    const first = testPort();
    const second = testPort();
    const controller = new LiveDraftController(
      async () => liveState("x", "complete"),
      async () => ({}),
    );
    controller.connect(first.port);
    controller.connect(second.port);
    first.receive({ type: "SUBSCRIBE", tabId: 7 });
    second.receive({ type: "SUBSCRIBE", tabId: 8 });
    await Promise.resolve();

    controller.notifyAccountDetected(7, {
      username: "signed_in_user",
      userId: "1234",
      leagueCount: 3,
    });

    expect(first.postMessage).toHaveBeenCalledWith({
      type: "SLEEPER_ACCOUNT_DETECTED",
      tabId: 7,
      username: "signed_in_user",
      userId: "1234",
      leagueCount: 3,
    });
    expect(second.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "SLEEPER_ACCOUNT_DETECTED" }),
    );
  });

  it("does not let a stale side-panel port fail account detection", async () => {
    const stale = testPort();
    const healthy = testPort();
    stale.postMessage.mockImplementation(() => {
      throw new Error("disconnected port");
    });
    const controller = new LiveDraftController(
      async () => liveState("x", "complete"),
      async () => ({}),
    );
    controller.connect(stale.port);
    controller.connect(healthy.port);
    stale.receive({ type: "SUBSCRIBE", tabId: 7 });
    healthy.receive({ type: "SUBSCRIBE", tabId: 7 });
    await Promise.resolve();

    expect(() =>
      controller.notifyAccountDetected(7, {
        username: "signed_in_user",
        userId: "1234",
        leagueCount: 3,
      }),
    ).not.toThrow();
    expect(healthy.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SLEEPER_ACCOUNT_DETECTED",
        leagueCount: 3,
      }),
    );
  });
});

function testPort() {
  const postMessage = vi.fn();
  let receiveMessage: (message: unknown) => void = () => undefined;
  const port = {
    name: "not-sleeping-live",
    sender: {
      id: "not-sleeping-test",
      url: "chrome-extension://not-sleeping-test/sidepanel.html",
    },
    postMessage,
    disconnect: vi.fn(),
    onMessage: {
      addListener: vi.fn((listener: (message: unknown) => void) => {
        receiveMessage = listener;
      }),
    },
    onDisconnect: { addListener: vi.fn() },
  } as unknown as chrome.runtime.Port;
  return {
    port,
    postMessage,
    receive: (message: unknown) => receiveMessage(message),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function liveState(
  draftId: string,
  status: LiveDraftState["context"]["status"],
): LiveDraftState {
  return {
    context: {
      supported: true,
      source: "sleeper",
      leagueName: "Mock",
      draftId,
      sessionKind: "standalone_mock",
      sessionKindConfidence: 1,
      sessionKindEvidence: ["Mock test"],
      sessionKindOverride: false,
      draftStyle: "snake",
      mode: "redraft",
      modeConfidence: 1,
      modeEvidence: ["Mock test"],
      status,
      currentPick: 1,
      currentRound: 1,
      ownedPickNumbers: [1],
      isUserOnClock: true,
      secondsRemaining: 120,
      lastUpdatedAt: Date.now(),
      connected: true,
    },
    format: {
      mode: "redraft",
      scoring: "standard",
      teams: 10,
      starters: {},
      bench: 0,
      taxi: 0,
      injuredReserve: 0,
      superflex: false,
      twoQuarterback: false,
      tightEndPremium: false,
      pointsPerFirstDown: false,
      idp: false,
      bestBall: false,
    },
    picks: [],
    players: [],
    fetchedAt: Date.now(),
    playerIndexStale: false,
  };
}
