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

export type NflverseRosterRow = z.infer<typeof rosterRowSchema>;

export class NflverseProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async downloadRosterCsv(season: number): Promise<Blob> {
    if (season < 1999 || season > new Date().getFullYear() + 1) {
      throw invalidSeason();
    }
    const url = `${RELEASE_BASE}/rosters/roster_${season}.csv`;
    const response = await this.fetcher(url);
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
    return response.blob();
  }

  validateRosterRows(rows: unknown[]): NflverseRosterRow[] {
    return rows.flatMap((row) => {
      const parsed = rosterRowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async removePublicData(): Promise<void> {
    await db.cacheMetadata.where("key").startsWith("nflverse:").delete();
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
