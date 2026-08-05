import { z } from "zod";

const nullableString = z.string().nullable().optional();
const flexibleRecord = z.record(z.string(), z.unknown());

// Sleeper sends an explicit `null` — not an omitted key — for empty maps, empty
// lists, and unset flags. Zod's `.default()` and `.optional()` only fire on
// `undefined`, so a bare `.default({})` throws on ordinary league payloads.
// Every container and flag below folds null in before defaulting.
// The trailing `.optional()` matters: a bare `.transform()` turns the object key
// from optional into required-with-undefined, which breaks every caller that
// builds a Sleeper-shaped literal.
const recordOrEmpty = flexibleRecord
  .nullish()
  .transform((value) => value ?? {});
const optionalRecord = flexibleRecord
  .nullish()
  .transform((value) => value ?? undefined)
  .optional();
const numericRecordOrEmpty = z
  .record(z.string(), z.number().nullable())
  .nullish()
  .transform((value) => value ?? {});
const listOrEmpty = <Item extends z.ZodType>(item: Item) =>
  z
    .array(item)
    .nullish()
    .transform((value) => value ?? []);
const optionalBoolean = z
  .boolean()
  .nullish()
  .transform((value) => value ?? undefined)
  .optional();

export const sleeperUserSchema = z
  .object({
    user_id: z.string(),
    username: nullableString,
    display_name: nullableString,
    avatar: nullableString,
    metadata: optionalRecord,
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
    settings: recordOrEmpty,
    scoring_settings: recordOrEmpty,
    roster_positions: listOrEmpty(z.string()),
    metadata: optionalRecord,
    previous_league_id: nullableString,
  })
  .loose();

export const sleeperLeagueUserSchema = sleeperUserSchema.extend({
  is_owner: optionalBoolean,
  metadata: optionalRecord,
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
    settings: recordOrEmpty,
    metadata: optionalRecord,
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
    settings: recordOrEmpty,
    metadata: recordOrEmpty,
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
    metadata: recordOrEmpty,
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
    news_updated: z.union([z.number(), z.string()]).nullable().optional(),
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

export const sleeperProjectionSchema = z
  .object({
    player_id: z.string(),
    stats: numericRecordOrEmpty,
  })
  .loose();

export const sleeperProjectionsSchema = z.array(sleeperProjectionSchema);

export const sleeperTrendingSchema = z.array(
  z
    .object({
      player_id: z.string(),
      count: z.number().int(),
    })
    .loose(),
);

export const sleeperMatchupSchema = z
  .object({
    roster_id: z.number().int(),
    matchup_id: z.number().int().nullable().optional(),
    points: z.number().nullable().default(0),
    custom_points: z.number().nullable().optional(),
    players: z.array(z.string()).nullable().default([]),
    starters: z.array(z.string()).nullable().default([]),
    players_points: numericRecordOrEmpty,
    starters_points: z.array(z.number().nullable()).nullable().optional(),
  })
  .loose();

export const sleeperTransactionSchema = z
  .object({
    transaction_id: z.string(),
    type: z.string(),
    status: z.string(),
    leg: z.number().int().optional(),
    creator: nullableString,
    created: z.number().nullable().optional(),
    status_updated: z.number().nullable().optional(),
    roster_ids: listOrEmpty(z.number().int()),
    consenter_ids: listOrEmpty(z.number().int()),
    adds: z.record(z.string(), z.number().int()).nullable().optional(),
    drops: z.record(z.string(), z.number().int()).nullable().optional(),
    draft_picks: listOrEmpty(sleeperTradedPickSchema),
    waiver_budget: listOrEmpty(
      z
        .object({
          sender: z.number().int(),
          receiver: z.number().int(),
          amount: z.number(),
        })
        .loose(),
    ),
    settings: recordOrEmpty,
    metadata: recordOrEmpty,
  })
  .loose();

export const sleeperBracketMatchSchema = z
  .object({
    r: z.number().int(),
    m: z.number().int(),
    t1: z.number().int().nullable().optional(),
    t2: z.number().int().nullable().optional(),
    w: z.number().int().nullable().optional(),
    l: z.number().int().nullable().optional(),
    p: z.number().int().nullable().optional(),
    t1_from: z.record(z.string(), z.number().int()).nullable().optional(),
    t2_from: z.record(z.string(), z.number().int()).nullable().optional(),
  })
  .loose();

export type SleeperUser = z.infer<typeof sleeperUserSchema>;
export type SleeperLeague = z.infer<typeof sleeperLeagueSchema>;
export type SleeperLeagueUser = z.infer<typeof sleeperLeagueUserSchema>;
export type SleeperRoster = z.infer<typeof sleeperRosterSchema>;
export type SleeperDraft = z.infer<typeof sleeperDraftSchema>;
export type SleeperDraftPick = z.infer<typeof sleeperDraftPickSchema>;
export type SleeperPlayerRecord = z.infer<typeof sleeperPlayerSchema>;
export type SleeperProjection = z.infer<typeof sleeperProjectionSchema>;
export type SleeperMatchup = z.infer<typeof sleeperMatchupSchema>;
export type SleeperTransaction = z.infer<typeof sleeperTransactionSchema>;
export type SleeperBracketMatch = z.infer<typeof sleeperBracketMatchSchema>;
