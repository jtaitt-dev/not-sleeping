import { normalizeError } from "@/services/errors/app-error";
import { logger } from "@/services/security/logger";
import type { LiveDraftState } from "@/types/domain";

type LiveContext = {
  draftId?: string;
  status?: string;
};

export class LiveDraftController {
  private readonly ports = new Set<chrome.runtime.Port>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private context: LiveContext = {};
  private pageVisible = true;
  private activeRefresh: {
    draftId: string;
    promise: Promise<void>;
  } | null = null;

  constructor(
    private readonly loadDraft: (draftId: string) => Promise<LiveDraftState>,
  ) {}

  connect(port: chrome.runtime.Port) {
    if (port.name !== "not-sleeping-live") return;
    this.ports.add(port);
    port.onMessage.addListener((message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        "visible" in message &&
        typeof (message as { visible?: unknown }).visible === "boolean"
      ) {
        this.pageVisible = (message as { visible: boolean }).visible;
        this.reconcile();
      }
    });
    port.onDisconnect.addListener(() => {
      this.ports.delete(port);
      this.reconcile();
    });
    this.reconcile();
  }

  updateContext(context: LiveContext) {
    const draftChanged = this.context.draftId !== context.draftId;
    this.context = context;
    this.reconcile();
    if (draftChanged && context.draftId) {
      void this.refreshNow();
    }
  }

  async refreshNow(): Promise<void> {
    const draftId = this.context.draftId;
    if (!draftId) return;
    if (this.activeRefresh?.draftId === draftId) {
      return this.activeRefresh.promise;
    }
    const promise = this.refresh(draftId).finally(() => {
      if (this.activeRefresh?.promise === promise) {
        this.activeRefresh = null;
      }
    });
    this.activeRefresh = { draftId, promise };
    return promise;
  }

  private reconcile() {
    const shouldPoll =
      this.ports.size > 0 &&
      this.pageVisible &&
      Boolean(this.context.draftId) &&
      this.context.status !== "complete" &&
      navigator.onLine;
    if (shouldPoll && !this.timer) {
      void this.refreshNow();
      this.timer = setInterval(() => void this.refreshNow(), 3000);
    } else if (!shouldPoll && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async refresh(draftId: string) {
    try {
      const state = await this.loadDraft(draftId);
      if (this.context.draftId !== draftId) return;
      this.context.status = state.context.status;
      for (const port of this.ports) {
        port.postMessage({
          type: "DRAFT_REFRESH",
          data: state,
        });
      }
      this.reconcile();
    } catch (error) {
      if (this.context.draftId !== draftId) return;
      const safe = normalizeError(error).toSafeObject();
      logger.warning("live_draft_refresh_failed", safe);
      for (const port of this.ports) {
        port.postMessage({ type: "DRAFT_REFRESH_ERROR", error: safe });
      }
    }
  }
}
