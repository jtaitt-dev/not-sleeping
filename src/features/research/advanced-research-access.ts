import { useEffect, useState } from "react";

import {
  APP_SETTINGS_KEY,
  getSettings,
  migrateSettings,
} from "@/services/storage/settings";

export type AdvancedResearchAccess = {
  ready: boolean;
  acknowledged: boolean;
  enabled: boolean;
};

const INITIAL_ACCESS: AdvancedResearchAccess = {
  ready: false,
  acknowledged: false,
  enabled: false,
};

export function useAdvancedResearchAccess(): AdvancedResearchAccess {
  const [access, setAccess] = useState(INITIAL_ACCESS);

  useEffect(() => {
    let active = true;
    const applySettings = (
      settings: Awaited<ReturnType<typeof getSettings>>,
    ) => {
      if (!active) return;
      const acknowledged = settings.advancedResearchAcknowledgedAt !== null;
      setAccess({
        ready: true,
        acknowledged,
        enabled: acknowledged && settings.advancedResearchEnabled,
      });
    };
    void getSettings()
      .then(applySettings)
      .catch(() => {
        if (!active) return;
        setAccess({ ready: true, acknowledged: false, enabled: false });
      });

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[APP_SETTINGS_KEY]) return;
      applySettings(migrateSettings(changes[APP_SETTINGS_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return access;
}
