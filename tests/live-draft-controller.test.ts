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
    const port = {
      name: "not-sleeping-live",
      postMessage,
      onMessage: { addListener: vi.fn() },
      onDisconnect: {
        addListener: vi.fn((listener: () => void) => {
          disconnect = listener;
        }),
      },
    } as unknown as chrome.runtime.Port;
    const controller = new LiveDraftController(loadDraft);

    controller.connect(port);
    controller.updateContext({ draftId: "old-draft" });
    controller.updateContext({ draftId: "new-draft" });

    expect(loadDraft).toHaveBeenCalledWith("old-draft");
    expect(loadDraft).toHaveBeenCalledWith("new-draft");

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
});

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
      mode: "redraft",
      modeConfidence: 1,
      modeEvidence: ["Mock test"],
      status,
      currentPick: 1,
      currentRound: 1,
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
