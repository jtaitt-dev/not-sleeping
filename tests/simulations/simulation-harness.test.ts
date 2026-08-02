// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  runSimulationSuite,
  simulationReportMarkdown,
} from "@/services/simulations/simulation-harness";

describe("Phase 2 simulation harness", () => {
  it("smoke simulation matrix", () => {
    const report = runSimulationSuite({ volume: 80 });
    assertReport(report, false);
  }, 20_000);

  const exhaustiveTest =
    process.env["PHASE2_EXHAUSTIVE"] === "1" ? it : it.skip;
  exhaustiveTest(
    "exhaustive 5,000-draft simulation matrix",
    () => {
      const report = runSimulationSuite({ volume: 5_000 });
      assertReport(report, true);
      expect(report.completeRecommendationReplays).toBeGreaterThanOrEqual(500);
      expect(report.categories.dynastyRookie).toBeGreaterThanOrEqual(250);
      expect(report.categories.dynastyStartup).toBeGreaterThanOrEqual(250);
      expect(report.categories.auction).toBeGreaterThanOrEqual(200);
      expect(report.categories.idp).toBeGreaterThanOrEqual(200);
      expect(report.categories.bestBall).toBeGreaterThanOrEqual(200);
      expect(report.categories.keeper).toBeGreaterThanOrEqual(100);
      expect(report.categories.choppedRedraft).toBeGreaterThan(0);
      expect(report.categories.choppedFaab).toBeGreaterThan(0);
      expect(report.categories.choppedTrades).toBeGreaterThan(0);
      expect(report.categories.choppedBestBall).toBeGreaterThan(0);
      expect(report.categories.bestBallWaivers).toBeGreaterThan(0);
      expect(report.categories.dynasty32).toBeGreaterThan(0);
      expect(report.categories.largeIdp).toBeGreaterThan(0);
      expect(report.categories.auctionIdp).toBeGreaterThan(0);
      expect(report.categories.auctionDynasty).toBeGreaterThan(0);
      expect(report.categories.keeperAuction).toBeGreaterThan(0);
      expect(report.categories.supplemental).toBeGreaterThan(0);
      expect(report.categories.unknownInputs).toBeGreaterThan(0);
      expect(report.categories.midDraftChanges).toBeGreaterThan(0);
    },
    180_000,
  );
});

function assertReport(
  report: ReturnType<typeof runSimulationSuite>,
  exhaustive: boolean,
): void {
  expect(report.failed, report.invariants.errors.join("\n")).toBe(0);
  expect(report.completed).toBe(report.requested);
  expect(report.calibration.recommendationRankStability).toBe(1);
  expect(report.calibration.rosterCompletionRate).toBe(1);
  expect(report.calibration.maximumRecommendationLatencyMs).toBeLessThan(500);
  expect(JSON.stringify(report)).not.toMatch(/sk-[a-z0-9_-]{8,}/i);
  const artifacts = resolve(process.cwd(), "artifacts");
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(
    resolve(
      artifacts,
      exhaustive ? "simulation-report.json" : "simulation-smoke-report.json",
    ),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(
      artifacts,
      exhaustive ? "simulation-report.md" : "simulation-smoke-report.md",
    ),
    simulationReportMarkdown(report),
    "utf8",
  );
}
