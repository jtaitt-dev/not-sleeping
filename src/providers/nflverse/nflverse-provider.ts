import { z } from "zod";

import { db } from "@/services/cache/database";
import { AppError } from "@/services/errors/app-error";

const RELEASE_BASE =
  "https://github.com/nflverse/nflverse-data/releases/download";

const rosterRowSchema = z.object({
  gsis_id: z.string().nullable().optional(),
  full_name: z.string(),
  team: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  draft_club: z.string().nullable().optional(),
  draft_number: z.coerce.number().nullable().optional(),
});

const scheduleRowSchema = z.object({
  game_id: z.string(),
  season: z.coerce.number().int(),
  week: z.coerce.number().int(),
  game_type: z.string(),
  gameday: z.string(),
  gametime: z.string().nullable().optional(),
  away_team: z.string(),
  home_team: z.string(),
  away_score: z.coerce.number().nullable().optional(),
  home_score: z.coerce.number().nullable().optional(),
  roof: z.string().nullable().optional(),
  surface: z.string().nullable().optional(),
  temp: z.coerce.number().nullable().optional(),
  wind: z.coerce.number().nullable().optional(),
});

const playerStatsRowSchema = z
  .object({
    player_id: z.string(),
    player_name: z.string().nullable().optional(),
    player_display_name: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    team: z.string().nullable().optional(),
    opponent_team: z.string().nullable().optional(),
    season: z.coerce.number().int(),
    week: z.coerce.number().int(),
    season_type: z.string(),
  })
  .loose();

const weeklyRosterRowSchema = z
  .object({
    season: z.coerce.number().int(),
    week: z.coerce.number().int(),
    team: z.string(),
    position: z.string().nullable().optional(),
    full_name: z.string(),
    gsis_id: z.string().nullable().optional(),
  })
  .loose();

const injuryRowSchema = z
  .object({
    season: z.coerce.number().int(),
    week: z.coerce.number().int(),
    team: z.string(),
    full_name: z.string(),
    report_status: z.string().nullable().optional(),
    practice_status: z.string().nullable().optional(),
  })
  .loose();

const depthChartRowSchema = z
  .object({
    season: z.coerce.number().int(),
    team: z.string(),
    position: z.string(),
    depth_team: z.coerce.number().nullable().optional(),
    full_name: z.string(),
    gsis_id: z.string().nullable().optional(),
  })
  .loose();

export type NflverseRosterRow = z.infer<typeof rosterRowSchema>;
export type NflverseScheduleRow = z.infer<typeof scheduleRowSchema>;
export type NflversePlayerStatsRow = z.infer<typeof playerStatsRowSchema>;
export type NflverseWeeklyRosterRow = z.infer<typeof weeklyRosterRowSchema>;
export type NflverseInjuryRow = z.infer<typeof injuryRowSchema>;
export type NflverseDepthChartRow = z.infer<typeof depthChartRowSchema>;

export type NflverseDataset =
  | "schedules"
  | "player_stats"
  | "weekly_rosters"
  | "injuries"
  | "depth_charts"
  | "season_rosters";

export class NflverseProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async downloadRosterCsv(season: number): Promise<Blob> {
    return this.downloadDatasetCsv("season_rosters", season);
  }

  async downloadDatasetCsv(
    dataset: NflverseDataset,
    season?: number,
  ): Promise<Blob> {
    if (dataset !== "schedules") validateSeason(season);
    const url = nflverseDatasetUrl(dataset, season);
    const response = await this.fetcher.call(globalThis, url);
    if (!response.ok) {
      throw new AppError({
        code: "SLEEPER_UNAVAILABLE",
        message: "Optional public data is unavailable.",
        safeDetail: `nflverse returned HTTP ${response.status}.`,
        suggestedAction:
          "Continue without optional public data or retry later.",
        retryable: response.status >= 500,
      });
    }
    const blob = await response.blob();
    if (blob.size === 0 || blob.size > 250 * 1024 * 1024) {
      throw new AppError({
        code: "INVALID_IMPORT",
        message: "The optional public dataset was rejected.",
        safeDetail: "The downloaded dataset had an invalid size.",
        suggestedAction: "Retry after checking nflverse release status.",
        retryable: true,
      });
    }
    return blob;
  }

  validateRosterRows(rows: unknown[]): NflverseRosterRow[] {
    return validateRows(rows, rosterRowSchema);
  }

  validateScheduleRows(rows: unknown[]): NflverseScheduleRow[] {
    return validateRows(rows, scheduleRowSchema);
  }

  validatePlayerStatsRows(rows: unknown[]): NflversePlayerStatsRow[] {
    return validateRows(rows, playerStatsRowSchema);
  }

  validateWeeklyRosterRows(rows: unknown[]): NflverseWeeklyRosterRow[] {
    return validateRows(rows, weeklyRosterRowSchema);
  }

  validateInjuryRows(rows: unknown[]): NflverseInjuryRow[] {
    return validateRows(rows, injuryRowSchema);
  }

  validateDepthChartRows(rows: unknown[]): NflverseDepthChartRow[] {
    return validateRows(rows, depthChartRowSchema);
  }

  async removePublicData(): Promise<void> {
    await db.cacheMetadata.where("key").startsWith("nflverse:").delete();
  }
}

export function nflverseDatasetUrl(
  dataset: NflverseDataset,
  season?: number,
): string {
  switch (dataset) {
    case "schedules":
      return `${RELEASE_BASE}/schedules/games.csv`;
    case "player_stats":
      return `${RELEASE_BASE}/stats_player/stats_player_week_${season}.csv`;
    case "weekly_rosters":
      return `${RELEASE_BASE}/weekly_rosters/roster_weekly_${season}.csv`;
    case "injuries":
      return `${RELEASE_BASE}/injuries/injuries_${season}.csv`;
    case "depth_charts":
      return `${RELEASE_BASE}/depth_charts/depth_charts_${season}.csv`;
    case "season_rosters":
      return `${RELEASE_BASE}/rosters/roster_${season}.csv`;
  }
}

function validateRows<T>(rows: unknown[], schema: z.ZodType<T>): T[] {
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

function validateSeason(season: number | undefined): asserts season is number {
  if (
    season === undefined ||
    !Number.isInteger(season) ||
    season < 1999 ||
    season > new Date().getFullYear() + 1
  ) {
    throw invalidSeason();
  }
}

function invalidSeason(): AppError {
  return new AppError({
    code: "INVALID_IMPORT",
    message: "The public-data season is invalid.",
    safeDetail: "The requested season is outside the supported range.",
    suggestedAction: "Choose a valid NFL season.",
    retryable: false,
  });
}
