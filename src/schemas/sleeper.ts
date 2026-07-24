import { z } from "zod";

const nullableString = z.string().nullable().optional();
const flexibleRecord = z.record(z.string(), z.unknown());

export const sleeperUserSchema = z
  .object({
    user_id: z.string(),
    username: nullableString,
    display_name: nullableString,
    avatar: nullableString,
    metadata: flexibleRecord.optional(),
  })
  .loose();

export const sleeperLeagueSchema = z
  .object({
    league_id: z.string(),
    name: z.string().default("Unnamed league"),
    season: z.string(),
    season_type: z.string().optional(),
    sport: z.string().default("nfl"),
    status: z.string().optional(),
    total_rosters: z.number().int().optional(),
    draft_id: nullableString,
    avatar: nullableString,
    settings: flexibleRecord.default({}),
    scoring_settings: flexibleRecord.default({}),
    roster_positions: z.array(z.string()).default([]),
    metadata: flexibleRecord.optional(),
    previous_league_id: nullableString,
  })
  .loose();

export const sleeperLeagueUserSchema = sleeperUserSchema.extend({
  is_owner: z.boolean().optional(),
  metadata: flexibleRecord.optional(),
});

export const sleeperRosterSchema = z
  .object({
    roster_id: z.number().int(),
    owner_id: nullableString,
    league_id: z.string(),
    players: z.array(z.string()).nullable().default([]),
    starters: z.array(z.string()).nullable().default([]),
    reserve: z.array(z.string()).nullable().optional(),
    taxi: z.array(z.string()).nullable().optional(),
    co_owners: z.array(z.string()).nullable().optional(),
    settings: flexibleRecord.default({}),
    metadata: flexibleRecord.optional(),
  })
  .loose();

export const sleeperDraftSchema = z
  .object({
    draft_id: z.string(),
    league_id: nullableString,
    type: z.string(),
    status: z.string(),
    season: z.string(),
    sport: z.string().default("nfl"),
    start_time: z.number().nullable().optional(),
    last_picked: z.number().nullable().optional(),
    last_message_time: z.number().nullable().optional(),
    settings: flexibleRecord.default({}),
    metadata: flexibleRecord.default({}),
    draft_order: z.record(z.string(), z.number()).nullable().optional(),
    slot_to_roster_id: z.record(z.string(), z.number()).nullable().optional(),
    creators: z.array(z.string()).optional(),
  })
  .loose();

export const sleeperDraftPickSchema = z
  .object({
    player_id: z.string(),
    picked_by: nullableString,
    roster_id: z.number().int().nullable().optional(),
    round: z.number().int(),
    draft_slot: z.number().int(),
    pick_no: z.number().int(),
    is_keeper: z.boolean().nullable().optional(),
    metadata: flexibleRecord.default({}),
  })
  .loose();

export const sleeperTradedPickSchema = z
  .object({
    season: z.string(),
    round: z.number().int(),
    roster_id: z.number().int(),
    previous_owner_id: z.number().int(),
    owner_id: z.number().int(),
  })
  .loose();

export const sleeperNflStateSchema = z
  .object({
    week: z.number().int(),
    season_type: z.string(),
    season_start_date: z.string(),
    season: z.string(),
    previous_season: z.string().optional(),
    leg: z.number().int().optional(),
    league_season: z.string().optional(),
    display_week: z.number().int().optional(),
  })
  .loose();

export const sleeperPlayerSchema = z
  .object({
    player_id: z.string().optional(),
    first_name: nullableString,
    last_name: nullableString,
    full_name: nullableString,
    position: nullableString,
    fantasy_positions: z.array(z.string()).nullable().optional(),
    team: nullableString,
    age: z.number().nullable().optional(),
    years_exp: z.number().nullable().optional(),
    status: nullableString,
    injury_status: nullableString,
    college: nullableString,
    birth_date: nullableString,
    search_rank: z.number().nullable().optional(),
    gsis_id: nullableString,
    espn_id: z.union([z.string(), z.number()]).nullable().optional(),
    yahoo_id: z.union([z.string(), z.number()]).nullable().optional(),
    fantasy_data_id: z.union([z.string(), z.number()]).nullable().optional(),
    metadata: flexibleRecord.nullable().optional(),
  })
  .loose();

export const sleeperPlayersSchema = z.record(z.string(), sleeperPlayerSchema);

export const sleeperTrendingSchema = z.array(
  z
    .object({
      player_id: z.string(),
      count: z.number().int(),
    })
    .loose(),
);

export type SleeperUser = z.infer<typeof sleeperUserSchema>;
export type SleeperLeague = z.infer<typeof sleeperLeagueSchema>;
export type SleeperRoster = z.infer<typeof sleeperRosterSchema>;
export type SleeperDraft = z.infer<typeof sleeperDraftSchema>;
export type SleeperDraftPick = z.infer<typeof sleeperDraftPickSchema>;
export type SleeperPlayerRecord = z.infer<typeof sleeperPlayerSchema>;
