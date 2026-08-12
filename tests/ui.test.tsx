import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/intelligence/provider-permissions", () => ({
  requestProviderHostPermission: vi.fn(async () => true),
}));

import { PositionBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import {
  SleeperInput,
  SleeperSearch,
  SleeperSelect,
} from "@/components/ui/form-controls";
import { SleeperBottomSheet } from "@/components/ui/overlays";
import { RealtimeIntelligenceCard } from "@/components/intelligence/realtime-intelligence-card";
import {
  DraftCopilotCard,
  draftAiActivityLabel,
} from "@/features/draft/draft-copilot-card";
import { SleeperRosterSlot } from "@/components/ui/roster-slot";
import { EmptyState } from "@/components/ui/states";
import { DEMO_PLAYERS } from "@/services/demo/fixtures";
import { getActiveFixture, getRecommendations } from "@/stores/app-store";

describe("shared UI primitives", () => {
  it("exposes button behavior and semantic badges", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <Button onClick={onClick}>Analyze</Button>
        <PositionBadge position="WR" />
        <StatusBadge tone="success">Connected</StatusBadge>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Position WR")).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
  });

  it("updates a compact tab through its accessible contract", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CompactTabs
        label="Player view"
        value="summary"
        onValueChange={onValueChange}
        items={[
          { value: "summary", label: "Summary" },
          { value: "research", label: "Research" },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: "Research" }));
    expect(onValueChange).toHaveBeenCalledWith("research");
  });

  it("labels shared search, input, and select controls", () => {
    render(
      <>
        <SleeperSearch label="Search players" placeholder="Search" />
        <SleeperInput aria-label="Sleeper username" />
        <SleeperSelect aria-label="Position" defaultValue="WR">
          <option value="WR">Wide receiver</option>
        </SleeperSelect>
      </>,
    );

    expect(
      screen.getByRole("searchbox", { name: "Search players" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Sleeper username" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Position" })).toHaveValue(
      "WR",
    );
  });

  it("closes a shared bottom sheet with Escape", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SleeperBottomSheet
        open
        onOpenChange={onOpenChange}
        label="Evidence drawer"
        title="Draft recommendation"
      >
        <button type="button">Inspect source</button>
      </SleeperBottomSheet>,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Draft recommendation",
    });
    expect(dialog).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Close Evidence drawer" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps realtime intelligence secondary until requested", async () => {
    const user = userEvent.setup();
    render(
      <RealtimeIntelligenceCard
        feature="draft"
        subject="On the clock"
        contextSummary="12-team superflex redraft"
        strategy="balanced"
        riskTolerance={50}
        candidates={[
          {
            id: "player-1",
            label: "Validated Player",
            position: "WR",
            baseValue: 90,
            available: true,
            eligible: true,
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /analysis/i })).not.toBeVisible();
    const summary = screen
      .getByText("Realtime intelligence")
      .closest("summary");
    expect(summary).not.toBeNull();
    await user.click(summary!);
    expect(screen.getByRole("button", { name: /analysis/i })).toBeVisible();
  });

  it("keeps Draft Copilot depth collapsed while preserving pick essentials", async () => {
    const user = userEvent.setup();
    const fixture = getActiveFixture("startup");
    const { container } = render(
      <DraftCopilotCard
        context={fixture.context}
        format={fixture.format}
        recommendations={getRecommendations("startup", 0, "balanced", 0.5, [])}
        strategy="balanced"
        riskTolerance={0.5}
      />,
    );

    expect(screen.getByText("Position need")).toBeVisible();
    expect(screen.getByText("Tier risk")).toBeVisible();
    const glance = container.querySelector("dl.draft-copilot__glance");
    expect(glance).not.toBeNull();
    expect(glance?.querySelectorAll(":scope > div > small")).toHaveLength(0);
    expect(glance?.querySelectorAll(":scope > div > dd > small")).toHaveLength(
      3,
    );
    const summary = screen
      .getByText("More draft intelligence")
      .closest("summary");
    expect(summary).not.toBeNull();
    expect(screen.getByText("Why now")).not.toBeVisible();
    await user.click(summary!);
    expect(screen.getByText("Why now")).toBeVisible();
  });

  it("shows on-clock AI activity and toggles it without leaving Draft", async () => {
    const user = userEvent.setup();
    const fixture = getActiveFixture("big-bucks");
    render(
      <DraftCopilotCard
        context={fixture.context}
        format={fixture.format}
        recommendations={getRecommendations(
          "big-bucks",
          0,
          "balanced",
          0.5,
          [],
        )}
        strategy="balanced"
        riskTolerance={0.5}
      />,
    );

    const enable = await screen.findByRole("switch", { name: "Turn AI on" });
    expect(enable).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByText(
        "Local recommendation is ready. Turn AI on for optional context.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("list", { name: "On-clock AI activity" }),
    ).toBeVisible();

    await user.click(enable);
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Turn AI off" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
    expect(
      screen.getByText("AI never submits a pick", { exact: false }),
    ).toBeVisible();
  });

  it("describes each visible on-clock AI stage in plain language", () => {
    expect(
      draftAiActivityLabel(true, true, undefined, "checking_context", 8),
    ).toBe("Checking current Sleeper status for 8 legal players.");
    expect(draftAiActivityLabel(true, true, "queued", "synthesizing", 8)).toBe(
      "Luna is comparing 8 legal players now.",
    );
    expect(draftAiActivityLabel(true, true, "ready", "ready", 8)).toBe(
      "Luna finished. Bounded context is included above.",
    );
  });

  it("renders shared roster slots and unique empty-state relationships", () => {
    const player = DEMO_PLAYERS[0]!;
    const { container } = render(
      <>
        <SleeperRosterSlot
          slot="QB"
          player={player}
          meta={`${player.team ?? "FA"} starter`}
          value="91"
        />
        <EmptyState title="No waivers" detail="No claims are pending." />
        <EmptyState title="No trades" detail="No offers are pending." />
      </>,
    );

    expect(screen.getByText(player.fullName)).toBeVisible();
    expect(screen.getByText("91")).toBeVisible();
    const labels = [...container.querySelectorAll(".empty-state")].map((node) =>
      node.getAttribute("aria-labelledby"),
    );
    expect(labels[0]).toBeTruthy();
    expect(labels[0]).not.toBe(labels[1]);
  });
});
