import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PositionBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";

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
});
