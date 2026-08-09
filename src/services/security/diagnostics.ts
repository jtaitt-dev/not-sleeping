import { db } from "@/services/cache/database";
import { logger } from "@/services/security/logger";
import { redactValue, stableAlias } from "@/services/security/redaction";
import { getSettings } from "@/services/storage/settings";

export async function exportRedactedDiagnostics(): Promise<
  Record<string, unknown>
> {
  const [settings, metadata, diagnosticEvents] = await Promise.all([
    getSettings(),
    db.cacheMetadata.toArray(),
    db.diagnostics.orderBy("timestamp").reverse().limit(100).toArray(),
  ]);
  const userAlias = settings.sleeperUserId
    ? await stableAlias("user", settings.sleeperUserId)
    : null;
  return redactValue({
    generatedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    platform:
      (
        navigator as Navigator & {
          userAgentData?: { platform?: string };
        }
      ).userAgentData?.platform ?? "unavailable",
    online: navigator.onLine,
    userAlias,
    build: {
      product: "unified",
      advancedResearchAcknowledged:
        settings.advancedResearchAcknowledgedAt !== null,
      advancedResearchEnabled:
        settings.advancedResearchAcknowledgedAt !== null &&
        settings.advancedResearchEnabled,
    },
    settings: {
      ...settings,
      sleeperUsername: "[REDACTED]",
      sleeperUserId: "[REDACTED]",
    },
    cacheMetadata: metadata,
    diagnostics: diagnosticEvents,
    logs: logger.export(),
  }) as Record<string, unknown>;
}
