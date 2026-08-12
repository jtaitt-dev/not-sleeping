import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TeamWorkspace } from "@/features/workspaces/all-workspaces";
import { useLeagueStore, type LeagueSnapshot } from "@/stores/league-store";
import type { Player } from "@/types/domain";
import type { LeagueContext } from "@/types/league";

describe("connected Team workspace", () => {
  afterEach(() => {
    useLeagueStore.setState({
      activeContext: null,
      snapshot: null,
      status: "idle",
      error: null,
    });
  });

  it("renders the selected league roster instead of recommendation candidates", () => {
    useLeagueStore.setState({
      activeContext: context(),
      snapshot: snapshot(),
      status: "ready",
      error: null,
    });

    render(<TeamWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Current roster" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Demo roster projection"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("16-team SF")).toBeVisible();

    const starters = screen.getByRole("list", { name: "Starters" });
    expect(within(starters).getByText("Connected Quarterback")).toBeVisible();
    expect(within(starters).getByText("Open")).toBeVisible();
    expect(
      within(screen.getByRole("list", { name: "Bench" })).getByText(
        "Connected Bench",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("list", { name: "Taxi Squad" })).getByText(
        "Connected Taxi",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("list", { name: "Reserve" })).getByText(
        "Connected Reserve",
      ),
    ).toBeVisible();
  });

  it("never renders a snapshot from another selected league", () => {
    const staleSnapshot = snapshot();
    useLeagueStore.setState({
      activeContext: { ...context(), leagueId: "new-league" },
      snapshot: staleSnapshot,
      status: "switching",
      error: null,
    });

    render(<TeamWorkspace />);

    expect(screen.getByText("Demo roster projection")).toBeVisible();
    expect(screen.queryByText("Connected Quarterback")).not.toBeInTheDocument();
  });
});

function context(): LeagueContext {
  return {
    leagueId: "connected-league",
    leagueName: "Connected League",
    season: "2026",
    week: 1,
    userId: "connected-user",
    rosterId: 7,
    leagueType: "dynasty",
    lineupType: "classic",
    draftStyle: "snake",
    waiverType: "faab",
    weeklyElimination: false,
    eliminationTiebreaker: null,
    rosterPositions: ["QB", "SUPER_FLEX", "BN", "TAXI", "IR"],
    scoringSettings: { rec: 1 },
    settings: {},
    strategy: "balanced",
    selectedMatchupId: null,
    dataFreshness: {},
  };
}

function snapshot(): LeagueSnapshot {
  return {
    userId: "connected-user",
    leagueId: "connected-league",
    week: 1,
    fetchedAt: Date.now(),
    league: {
      league_id: "connected-league",
      name: "Connected League",
      season: "2026",
      sport: "nfl",
      total_rosters: 16,
      settings: {},
      scoring_settings: {},
      roster_positions: ["QB", "SUPER_FLEX", "BN", "TAXI", "IR"],
    },
    users: [],
    rosters: [
      {
        roster_id: 7,
        owner_id: "connected-user",
        league_id: "connected-league",
        players: ["live-qb", "live-bench", "live-taxi", "live-reserve"],
        starters: ["live-qb", "0"],
        taxi: ["live-taxi"],
        reserve: ["live-reserve"],
        settings: {},
      },
    ],
    matchups: [],
    transactions: [],
    winnersBracket: [],
    losersBracket: [],
    tradedPicks: [],
    drafts: [],
    players: [
      connectedPlayer("live-qb", "Connected Quarterback", "QB"),
      connectedPlayer("live-bench", "Connected Bench", "RB"),
      connectedPlayer("live-taxi", "Connected Taxi", "WR"),
      connectedPlayer("live-reserve", "Connected Reserve", "TE"),
    ],
    projections: [],
  };
}

function connectedPlayer(
  id: string,
  fullName: string,
  position: Player["position"],
): Player {
  const [firstName = "Connected", ...lastParts] = fullName.split(" ");
  return {
    id,
    sleeperId: id,
    firstName,
    lastName: lastParts.join(" "),
    fullName,
    normalizedName: fullName.toLowerCase(),
    position,
    team: "BUF",
    age: 25,
    status: "active",
    fantasyPositions: [position],
  };
}
