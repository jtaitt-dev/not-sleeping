import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_SETTINGS, getSettings } from "@/services/storage/settings";
import type { Theme } from "@/types/domain";

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
