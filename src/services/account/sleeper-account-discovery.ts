import type { SleeperUser } from "@/schemas/sleeper";
import { AppError } from "@/services/errors/app-error";
import type { LeagueCatalogItem } from "@/services/league/league-service";
import type { AppSettings } from "@/types/domain";

export type DetectedSleeperAccount = {
  username: string;
  userId: string;
  leagueCount: number;
};

type DiscoveryDependencies = {
  getUser: (username: string) => Promise<SleeperUser>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  resolveSyncWindow: () => Promise<{ seasons: string[]; week: number }>;
  syncCatalog: (input: {
    userId: string;
    seasons: string[];
    week: number;
  }) => Promise<LeagueCatalogItem[]>;
};

/** Resolve and sync before publishing the account setting, so an already-open
 * side panel never observes a connected account with an empty catalog. */
export async function discoverSleeperAccount(
  username: string,
  dependencies: DiscoveryDependencies,
): Promise<DetectedSleeperAccount> {
  const user = await runDiscoveryStage("resolve", () =>
    dependencies.getUser(username),
  );
  const syncWindow = await runDiscoveryStage("sync", () =>
    dependencies.resolveSyncWindow(),
  );
  const catalog = await runDiscoveryStage("sync", () =>
    dependencies.syncCatalog({
      userId: user.user_id,
      ...syncWindow,
    }),
  );
  const settings = await runDiscoveryStage("settings", () =>
    dependencies.getSettings(),
  );
  const resolvedUsername = user.username?.trim();
  const canonicalUsername =
    resolvedUsername === undefined || resolvedUsername.length === 0
      ? username
      : resolvedUsername;
  await runDiscoveryStage("settings", () =>
    dependencies.saveSettings({
      ...settings,
      sleeperUsername: canonicalUsername,
      sleeperUserId: user.user_id,
    }),
  );
  return {
    username: canonicalUsername,
    userId: user.user_id,
    leagueCount: catalog.length,
  };
}

async function runDiscoveryStage<T>(
  stage: "resolve" | "sync" | "settings",
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const causeName = error instanceof Error ? error.name : "UnknownError";
    const providerShapeFailure = causeName === "ZodError";
    const localCatalogFailure = stage === "sync" && !providerShapeFailure;
    throw new AppError({
      code: localCatalogFailure
        ? "INDEXED_DB_FAILURE"
        : stage === "settings"
          ? "PERMISSION_FAILURE"
          : "SLEEPER_UNAVAILABLE",
      message: localCatalogFailure
        ? "Your Sleeper leagues could not be saved locally."
        : stage === "settings"
          ? "The detected Sleeper account could not be saved."
          : "Sleeper returned data the extension could not use.",
      safeDetail: `Automatic account discovery failed during ${stage} (${causeName}).`,
      suggestedAction: localCatalogFailure
        ? "Reload the extension once to finish the local database upgrade, then retry."
        : "Retry from a signed-in Sleeper page.",
      retryable: true,
      cause: error,
    });
  }
}
