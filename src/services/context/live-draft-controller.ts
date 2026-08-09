import { normalizeError } from "@/services/errors/app-error";
import { logger } from "@/services/security/logger";
import type { LiveDraftState } from "@/types/domain";

type LiveContext = {
  draftId?: string;
  leagueId?: string;
  status?: string;
};

type PortState = {
  tabId: number | null;
  visible: boolean;
};

export class LiveDraftController {
  private readonly ports = new Map<chrome.runtime.Port, PortState>();
  private readonly contexts = new Map<number, LiveContext>();
  private readonly timers = new Map<
    number,
    ReturnType<typeof globalThis.setInterval>
  >();
  private readonly activeRefreshes = new Map<
    number,
    { draftId: string; promise: Promise<void> }
  >();

  constructor(
    private readonly loadDraft: (
      draftId: string,
      tabId: number,
    ) => Promise<LiveDraftState>,
    private readonly loadContext: (tabId: number) => Promise<LiveContext>,
  ) {}

  connect(port: chrome.runtime.Port) {
    if (port.name !== "not-sleeping-live" || !isTrustedSidePanelPort(port)) {
      port.disconnect();
      return;
    }
    this.ports.set(port, { tabId: null, visible: true });
    port.onMessage.addListener((message: unknown) => {
      if (!message || typeof message !== "object") return;
      const record = message as Record<string, unknown>;
      if (
        record["type"] === "SUBSCRIBE" &&
        Number.isInteger(record["tabId"]) &&
        Number(record["tabId"]) >= 0
      ) {
        const tabId = Number(record["tabId"]);
        const state = this.ports.get(port);
        if (!state) return;
        const priorTab = state.tabId;
        this.ports.set(port, { ...state, tabId });
        if (priorTab !== null && priorTab !== tabId) this.reconcile(priorTab);
        void this.loadContext(tabId)
          .then((context) => {
            if (!this.contexts.has(tabId)) this.updateContext(tabId, context);
            else this.reconcile(tabId);
          })
          .catch(() => this.reconcile(tabId));
        return;
      }
      if (typeof record["visible"] === "boolean") {
        const state = this.ports.get(port);
        if (!state) return;
        this.ports.set(port, { ...state, visible: record["visible"] });
        if (state.tabId !== null) this.reconcile(state.tabId);
      }
    });
    port.onDisconnect.addListener(() => {
      const tabId = this.ports.get(port)?.tabId ?? null;
      this.ports.delete(port);
      if (tabId !== null) this.reconcile(tabId);
    });
  }

  updateContext(tabId: number, context: LiveContext) {
    const prior = this.contexts.get(tabId);
    const draftChanged = prior?.draftId !== context.draftId;
    this.contexts.set(tabId, context);
    this.reconcile(tabId);
    if (draftChanged && context.draftId) void this.refreshNow(tabId);
  }

  async refreshNow(tabId: number): Promise<void> {
    const draftId = this.contexts.get(tabId)?.draftId;
    if (!draftId) return;
    const active = this.activeRefreshes.get(tabId);
    if (active?.draftId === draftId) return active.promise;
    const promise = this.refresh(tabId, draftId).finally(() => {
      if (this.activeRefreshes.get(tabId)?.promise === promise) {
        this.activeRefreshes.delete(tabId);
      }
    });
    this.activeRefreshes.set(tabId, { draftId, promise });
    return promise;
  }

  private reconcile(tabId: number) {
    const context = this.contexts.get(tabId);
    const hasVisibleSubscriber = [...this.ports.values()].some(
      (state) => state.tabId === tabId && state.visible,
    );
    const shouldPoll =
      hasVisibleSubscriber &&
      Boolean(context?.draftId) &&
      context?.status !== "complete" &&
      navigator.onLine;
    const timer = this.timers.get(tabId);
    if (shouldPoll && !timer) {
      void this.refreshNow(tabId);
      this.timers.set(
        tabId,
        globalThis.setInterval(() => void this.refreshNow(tabId), 3_000),
      );
    } else if (!shouldPoll && timer) {
      globalThis.clearInterval(timer);
      this.timers.delete(tabId);
    }
  }

  private async refresh(tabId: number, draftId: string) {
    try {
      const state = await this.loadDraft(draftId, tabId);
      const context = this.contexts.get(tabId);
      if (context?.draftId !== draftId) return;
      context.status = state.context.status;
      this.broadcast(tabId, {
        type: "DRAFT_REFRESH",
        tabId,
        draftId,
        leagueId: state.context.leagueId,
        data: state,
      });
      this.reconcile(tabId);
    } catch (error) {
      if (this.contexts.get(tabId)?.draftId !== draftId) return;
      const safe = normalizeError(error).toSafeObject();
      logger.warning("live_draft_refresh_failed", safe);
      this.broadcast(tabId, {
        type: "DRAFT_REFRESH_ERROR",
        tabId,
        draftId,
        error: safe,
      });
    }
  }

  private broadcast(tabId: number, message: Record<string, unknown>) {
    for (const [port, state] of this.ports) {
      if (state.tabId === tabId) port.postMessage(message);
    }
  }
}

function isTrustedSidePanelPort(port: chrome.runtime.Port): boolean {
  if (port.sender?.id !== chrome.runtime.id) return false;
  try {
    const url = new URL(port.sender.url ?? "");
    return (
      url.protocol === "chrome-extension:" &&
      url.hostname === chrome.runtime.id &&
      url.pathname.endsWith("/sidepanel.html")
    );
  } catch {
    return false;
  }
}
