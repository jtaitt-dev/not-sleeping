import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_SETTINGS, getSettings } from "@/services/storage/settings";
import { resolveLeagueDraftId } from "@/services/draft/league-draft-selection";
import { safeRuntimeError } from "@/services/messaging/runtime-client";
import { useAppStore } from "@/stores/app-store";
import { useLeagueStore } from "@/stores/league-store";
import type { LiveDraftState, Theme } from "@/types/domain";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function RootProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_SETTINGS.theme);
  const [reducedMotion, setReducedMotion] = useState(
    DEFAULT_SETTINGS.reducedMotion,
  );
  const hydrate = useAppStore((state) => state.hydrate);
  const hydrateLeagues = useLeagueStore((state) => state.hydrate);
  const setLiveState = useAppStore((state) => state.setLiveState);
  const setRuntimeError = useAppStore((state) => state.setRuntimeError);

  useEffect(() => {
    const lifecycle = { active: true };
    void getSettings().then((settings) => {
      if (!lifecycle.active) return;
      setTheme(settings.theme);
      setReducedMotion(settings.reducedMotion);
    });
    return () => {
      lifecycle.active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasRuntime()) return;
    const lifecycle = { active: true };
    const isActive = () => lifecycle.active;
    let port: chrome.runtime.Port | null = null;
    let boundTabId: number | undefined;
    const sendVisibility = () => {
      port?.postMessage({ visible: document.visibilityState === "visible" });
    };
    const onMessage = (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const record = message as Record<string, unknown>;
      if (
        record["type"] === "DRAFT_REFRESH" &&
        record["tabId"] === boundTabId &&
        isLiveDraft(record["data"]) &&
        record["draftId"] === record["data"].context.draftId
      ) {
        setLiveState(record["data"]);
      } else if (
        record["type"] === "SLEEPER_ACCOUNT_DETECTED" &&
        record["tabId"] === boundTabId
      ) {
        void hydrateLeagues().then(() => {
          if (!isActive() || !port || boundTabId === undefined) return;
          // Account discovery can finish after the first route update. Ask
          // the controller for that same tab context again once the catalog
          // exists so the visible league cannot remain stuck on catalog[0].
          port.postMessage({ type: "SUBSCRIBE", tabId: boundTabId });
        });
      } else if (
        record["type"] === "SLEEPER_CONTEXT_UPDATE" &&
        record["tabId"] === boundTabId
      ) {
        void selectSleeperRouteLeague(
          typeof record["leagueId"] === "string" ? record["leagueId"] : null,
        );
      } else if (
        record["type"] === "DRAFT_REFRESH_ERROR" &&
        record["tabId"] === boundTabId
      ) {
        setRuntimeError(
          safeRuntimeError(record["error"]),
          typeof record["draftId"] === "string" ? record["draftId"] : undefined,
        );
      }
    };
    void activeSleeperTabId().then(async (tabId) => {
      if (!isActive()) return;
      boundTabId = tabId;
      await Promise.all([hydrate(tabId), hydrateLeagues()]);
      if (!isActive()) return;
      await reconcileHydratedLeagueDraft();
      if (!isActive()) return;
      port = chrome.runtime.connect({ name: "not-sleeping-live" });
      port.onMessage.addListener(onMessage);
      document.addEventListener("visibilitychange", sendVisibility);
      if (tabId !== undefined) {
        port.postMessage({ type: "SUBSCRIBE", tabId });
      }
      sendVisibility();
    });
    return () => {
      lifecycle.active = false;
      document.removeEventListener("visibilitychange", sendVisibility);
      port?.onMessage.removeListener(onMessage);
      port?.disconnect();
    };
  }, [hydrate, hydrateLeagues, setLiveState, setRuntimeError]);

  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={350}>
        <div
          data-theme={theme}
          data-reduced-motion={reducedMotion}
          className="theme-root"
        >
          {children}
        </div>
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}

/**
 * A non-draft Sleeper route has no tab draft to hydrate. Once the account and
 * league catalog are ready, bind the draft workspace to that selected
 * league's authoritative board instead of leaving an unrelated demo fixture
 * visible beside a real league name.
 */
export async function reconcileHydratedLeagueDraft(): Promise<void> {
  const app = useAppStore.getState();
  if (!app.demoEnabled) return;
  const league = useLeagueStore.getState();
  if (!league.activeContext || !league.snapshot) return;
  await app.selectLeagueDraft(
    league.activeContext.leagueId,
    resolveLeagueDraftId({
      league: league.snapshot.league,
      drafts: league.snapshot.drafts,
    }),
  );
}

/**
 * Keep every connected workspace aligned with the league visible in the
 * bound Sleeper tab. Route updates are authoritative only when that league is
 * present in the detected account catalog; unknown IDs cannot replace the
 * user's explicit selection.
 */
export async function selectSleeperRouteLeague(
  leagueId: string | null,
): Promise<void> {
  if (!leagueId) return;
  const league = useLeagueStore.getState();
  if (
    league.activeContext?.leagueId === leagueId ||
    !league.catalog.some((entry) => entry.leagueId === leagueId)
  ) {
    return;
  }
  await league.selectLeague(leagueId, { syncDraft: false });
  await reconcileHydratedLeagueDraft();
}

async function activeSleeperTabId(): Promise<number | undefined> {
  if (typeof chrome.tabs.query !== "function") return undefined;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function hasRuntime(): boolean {
  return (
    typeof chrome !== "undefined" &&
    Boolean(chrome.runtime.id) &&
    typeof chrome.runtime.connect === "function"
  );
}

function isLiveDraft(value: unknown): value is LiveDraftState {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Boolean(record["context"]) &&
    Boolean(record["format"]) &&
    Array.isArray(record["picks"]) &&
    Array.isArray(record["players"])
  );
}
