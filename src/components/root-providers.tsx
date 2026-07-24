import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_SETTINGS, getSettings } from "@/services/storage/settings";
import { safeRuntimeError } from "@/services/messaging/runtime-client";
import { useAppStore } from "@/stores/app-store";
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
  const setLiveState = useAppStore((state) => state.setLiveState);
  const setRuntimeError = useAppStore((state) => state.setRuntimeError);

  useEffect(() => {
    let active = true;
    void getSettings().then((settings) => {
      if (!active) return;
      setTheme(settings.theme);
      setReducedMotion(settings.reducedMotion);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasRuntime()) return;
    void hydrate();
    const port = chrome.runtime.connect({ name: "not-sleeping-live" });
    const sendVisibility = () =>
      port.postMessage({ visible: document.visibilityState === "visible" });
    const onMessage = (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const record = message as Record<string, unknown>;
      if (record["type"] === "DRAFT_REFRESH" && isLiveDraft(record["data"])) {
        setLiveState(record["data"]);
      } else if (record["type"] === "DRAFT_REFRESH_ERROR") {
        setRuntimeError(safeRuntimeError(record["error"]));
      }
    };
    port.onMessage.addListener(onMessage);
    document.addEventListener("visibilitychange", sendVisibility);
    sendVisibility();
    return () => {
      document.removeEventListener("visibilitychange", sendVisibility);
      port.onMessage.removeListener(onMessage);
      port.disconnect();
    };
  }, [hydrate, setLiveState, setRuntimeError]);

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
