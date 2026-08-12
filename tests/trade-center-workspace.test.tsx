import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { TradeCenterWorkspace } from "@/features/season/full-season-workspaces";
import { useLeagueStore } from "@/stores/league-store";

import {
  tradeContext as context,
  tradeSnapshot as snapshot,
} from "./fixtures/trade-center-fixture";

describe("connected Trade Center workspace", () => {
  afterEach(() => {
    useLeagueStore.setState({
      activeContext: null,
      snapshot: null,
      status: "idle",
      error: null,
    });
  });

  it("renders selected-league players and picks with accessible controls", async () => {
    const user = userEvent.setup();
    useLeagueStore.setState({
      activeContext: context(),
      snapshot: snapshot(),
      status: "ready",
      error: null,
    });

    render(<TradeCenterWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Trade partners" }),
    ).toBeVisible();
    const partnerRail = screen.getByRole("list", {
      name: "Trade partner rosters",
    });
    expect(
      within(partnerRail).getByRole("button", { name: /Trade Partner/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const userAssets = screen.getByRole("list", {
      name: "Night Shift trade assets",
    });
    const partnerAssets = screen.getByRole("list", {
      name: "Trade Partner trade assets",
    });
    expect(within(userAssets).getByText("User Receiver")).toBeVisible();
    expect(within(userAssets).getByText(/via Trade Partner/)).toBeVisible();
    expect(within(partnerAssets).getByText("Partner Tight End")).toBeVisible();
    expect(
      screen.getByText(
        "0 league-scored · 6 imported fallback · 0 rank proxy across 6 rostered players",
      ),
    ).toBeVisible();

    await user.click(
      within(userAssets).getByRole("button", { name: /User Receiver/ }),
    );
    await user.click(
      within(partnerAssets).getByRole("button", {
        name: /Partner Tight End/,
      }),
    );

    expect(
      within(userAssets).getByRole("button", { name: /User Receiver/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("30.0 → 24.0 projected starter pts/week"),
    ).toBeVisible();
    expect(
      screen.getByText("22.0 → 28.0 projected starter pts/week"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Open Trades in Sleeper/ }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Analysis only — Not Sleeping never sends or accepts Sleeper trades.",
      ),
    ).toBeVisible();
  });

  it("does not render stale assets during a cross-league switch", () => {
    useLeagueStore.setState({
      activeContext: { ...context(), leagueId: "next-league" },
      snapshot: snapshot(),
      status: "switching",
      error: null,
    });

    render(<TradeCenterWorkspace />);

    expect(screen.queryByText("User Receiver")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Refreshing trade data" }),
    ).toBeVisible();
  });

  it("distinguishes a league with no owned trade partner", () => {
    const soloSnapshot = snapshot();
    for (const roster of soloSnapshot.rosters) {
      if (roster.roster_id !== context().rosterId) roster.owner_id = null;
    }
    useLeagueStore.setState({
      activeContext: context(),
      snapshot: soloSnapshot,
      status: "ready",
      error: null,
    });

    render(<TradeCenterWorkspace />);

    expect(
      screen.getByRole("heading", { name: "No trade partners available" }),
    ).toBeVisible();
    expect(screen.queryByText("No league selected")).not.toBeInTheDocument();
  });
});
