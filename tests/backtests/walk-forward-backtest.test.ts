// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  backtestReportMarkdown,
  runWalkForwardBacktests,
} from "@/services/backtests/walk-forward-backtest";
import {
  NFLVERSE_FIXTURE_METADATA,
  NFLVERSE_WEEKLY_SAMPLE,
} from "../fixtures/nflverse-weekly-sample";

describe("walk-forward historical backtesting", () => {
  it("start/sit uses only prior-week inputs and reports hindsight regret honestly", () => {
    const report = buildAndWriteReport();
    expect(report.startSit.decisions).toBeGreaterThan(10);
    expect(report.startSit.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.startSit.accuracy).toBeLessThanOrEqual(1);
    expect(report.startSit.meanRegret).toBeGreaterThanOrEqual(0);
    expect(report.dataPolicy.leakageRule).toContain("week < W");
  });

  it("waivers evaluates future lift only after a historical trigger", () => {
    const report = buildAndWriteReport();
    expect(report.waivers.candidates).toBeGreaterThan(0);
    expect(report.waivers.falsePositiveRate).not.toBeNull();
  });

  it("draft replay labels the prior-season proxy and unavailable historical ADP", () => {
    const report = buildAndWriteReport();
    expect(report.draft.seasonTransitions).toBe(1);
    expect(report.draft.historicalAdpAvailable).toBe(false);
    expect(report.draft.baseline).toContain("not historical ADP");
  });
});

function buildAndWriteReport() {
  expect(NFLVERSE_FIXTURE_METADATA.license).toContain("CC-BY-4.0");
  const report = runWalkForwardBacktests(NFLVERSE_WEEKLY_SAMPLE);
  const artifacts = resolve(process.cwd(), "artifacts");
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(
    resolve(artifacts, "backtest-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(artifacts, "backtest-report.md"),
    backtestReportMarkdown(report),
    "utf8",
  );
  return report;
}
