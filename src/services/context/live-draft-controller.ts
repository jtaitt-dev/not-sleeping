import type { SleeperProvider } from "@/providers/sleeper/sleeper-provider";
import { normalizeError } from "@/services/errors/app-error";
import { logger } from "@/services/security/logger";

type LiveContext = {
  draftId?: string;
  status?: string;
};

export class LiveDraftController {
  private readonly ports = new Set<chrome.runtime.Port>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private context: LiveContext = {};
  private pageVisible = true;
  private activeRefresh: Promise<void> | null = null;

  constructor(private readonly sleeper: SleeperProvider) {}

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
    this.context = context;
    this.reconcile();
  }

  async refreshNow(): Promise<void> {
    if (this.activeRefresh) return this.activeRefresh;
    const draftId = this.context.draftId;
    if (!draftId) return;
    this.activeRefresh = this.refresh(draftId).finally(() => {
      this.activeRefresh = null;
    });
    return this.activeRefresh;
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
      const [draft, picks, tradedPicks] = await Promise.all([
        this.sleeper.getDraft(draftId),
        this.sleeper.getDraftPicks(draftId),
        this.sleeper.getDraftTradedPicks(draftId),
      ]);
      this.context.status = draft.status;
      for (const port of this.ports) {
        port.postMessage({
          type: "DRAFT_REFRESH",
          data: {
            draft,
            picks,
            tradedPicks,
            fetchedAt: Date.now(),
          },
        });
      }
      this.reconcile();
    } catch (error) {
      const safe = normalizeError(error).toSafeObject();
      logger.warning("live_draft_refresh_failed", safe);
      for (const port of this.ports) {
        port.postMessage({ type: "DRAFT_REFRESH_ERROR", error: safe });
      }
    }
  }
}
