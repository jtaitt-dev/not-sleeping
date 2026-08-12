import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LeaguesWorkspace } from "@/features/season/full-season-workspaces";
import { useLeagueStore, type LeagueSnapshot } from "@/stores/league-store";
import type { LeagueContext } from "@/types/league";

describe("connected Leagues workspace", () => {
  afterEach(() => {
    useLeagueStore.setState({
      catalog: [],
      activeContext: null,
      snapshot: null,
      status: "idle",
      error: null,
    });
  });

  it("renders the selected snapshot as semantic league sections", () => {
    useLeagueStore.setState({
      catalog: [
        {
          leagueId: "connected-league",
          name: "Connected League",
          season: "2026",
          leagueType: "dynasty",
          lineupType: "classic",
          draftStyle: "snake",
          favorite: true,
          lastUsedAt: 1_786_484_800_000,
          rosterId: 1,
        },
      ],
      activeContext: context(),
      snapshot: snapshot(),
      status: "ready",
      error: null,
    });

    const { container } = render(<LeaguesWorkspace />);

    expect(screen.getByRole("heading", { name: "Teams" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Standings" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Recent Activity" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "League Settings" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your leagues" })).toBeVisible();

    const teams = screen.getByRole("list", { name: "League teams" });
    expect(within(teams).getAllByRole("listitem")).toHaveLength(2);
    expect(within(teams).getByText("Night Shift")).toBeVisible();
    expect(within(teams).getByText("Draft position 2")).toBeVisible();

    const standings = screen.getByRole("list", { name: "League standings" });
    expect(within(standings).getAllByRole("listitem")).toHaveLength(2);
    expect(within(standings).getByText("1,301.07")).toBeVisible();
    expect(within(standings).getByText("$70 · #2")).toBeVisible();

    const activity = screen.getByRole("list", {
      name: "Recent league activity",
    });
    expect(within(activity).getAllByRole("listitem")).toHaveLength(2);
    expect(within(activity).getAllByText("Available Runner")).toHaveLength(2);

    expect(screen.getByText("Injured Reserve Slots")).toBeVisible();
    expect(screen.queryByText("connected-league")).not.toBeInTheDocument();
    expect(
      container.querySelector(".league-directory-row > button"),
    ).toHaveAttribute("aria-current", "true");
  });

  it("never exposes prior-league data while selection is switching", () => {
    useLeagueStore.setState({
      activeContext: {
        ...context(),
        leagueId: "new-league",
        leagueName: "New League",
      },
      snapshot: snapshot(),
      status: "switching",
      error: null,
    });

    render(<LeaguesWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Switching league" }),
    ).toBeVisible();
    expect(screen.queryByText("Night Shift")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "League standings" }),
    ).not.toBeInTheDocument();
  });
});

function context(): LeagueContext {
  return {
    leagueId: "connected-league",
    leagueName: "Connected League",
    season: "2026",
    week: 1,
    userId: "user-one",
    rosterId: 1,
    leagueType: "dynasty",
    lineupType: "classic",
    draftStyle: "snake",
    waiverType: "faab_with_rolling_tiebreak",
    weeklyElimination: false,
    eliminationTiebreaker: null,
    rosterPositions: ["QB", "RB", "WR", "TE", "BN", "IR", "TAXI"],
    scoringSettings: { rec: 1 },
    settings: { waiver_budget: 100, reserve_slots: 3, taxi_slots: 4 },
    strategy: "balanced",
    selectedMatchupId: null,
    dataFreshness: {},
  };
}

function snapshot(): LeagueSnapshot {
  return {
    userId: "user-one",
    leagueId: "connected-league",
    week: 1,
    fetchedAt: 1_786_484_800_000,
    league: {
      league_id: "connected-league",
      name: "Connected League",
      season: "2026",
      sport: "nfl",
      total_rosters: 2,
      draft_id: "current-draft",
      settings: {},
      scoring_settings: {},
      roster_positions: [],
    },
    users: [
      {
        user_id: "user-one",
        username: "joshua",
        display_name: "Joshua",
        avatar: "avatar-one",
        metadata: { team_name: "Night Shift" },
      },
      {
        user_id: "user-two",
        username: "sunday-manager",
        display_name: "Sunday Manager",
        avatar: null,
        metadata: { team_name: "Sunday Crew" },
      },
    ],
    rosters: [
      {
        roster_id: 1,
        owner_id: "user-one",
        league_id: "connected-league",
        players: [],
        starters: [],
        settings: {
          wins: 6,
          losses: 3,
          fpts: 1_250,
          fpts_decimal: 45,
          waiver_budget_used: 10,
          waiver_position: 1,
        },
      },
      {
        roster_id: 2,
        owner_id: "user-two",
        league_id: "connected-league",
        players: [],
        starters: [],
        settings: {
          wins: 7,
          losses: 2,
          fpts: 1_301,
          fpts_decimal: 7,
          waiver_budget_used: 30,
          waiver_position: 2,
        },
      },
    ],
    matchups: [],
    transactions: [
      {
        transaction_id: "new-add",
        type: "waiver",
        status: "complete",
        creator: "user-two",
        created: 1_786_484_800_000,
        roster_ids: [2],
        consenter_ids: [],
        adds: { "available-runner": 2 },
        draft_picks: [],
        waiver_budget: [],
        settings: {},
        metadata: {},
      },
      {
        transaction_id: "old-drop",
        type: "free_agent",
        status: "complete",
        creator: "user-one",
        created: 1_786_480_000,
        roster_ids: [1],
        consenter_ids: [],
        drops: { "available-runner": 1 },
        draft_picks: [],
        waiver_budget: [],
        settings: {},
        metadata: {},
      },
    ],
    winnersBracket: [],
    losersBracket: [],
    tradedPicks: [],
    drafts: [
      {
        draft_id: "current-draft",
        league_id: "connected-league",
        type: "snake",
        status: "pre_draft",
        season: "2026",
        sport: "nfl",
        settings: {},
        metadata: {},
        draft_order: { "user-one": 2, "user-two": 1 },
      },
    ],
    players: [
      {
        id: "available-runner",
        sleeperId: "available-runner",
        firstName: "Available",
        lastName: "Runner",
        fullName: "Available Runner",
        normalizedName: "available runner",
        position: "RB",
        team: "BUF",
        status: "active",
        fantasyPositions: ["RB"],
      },
    ],
    projections: [],
  };
}
