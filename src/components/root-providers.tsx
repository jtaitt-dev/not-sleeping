import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_SETTINGS, getSettings } from "@/services/storage/settings";
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
        void hydrateLeagues();
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
