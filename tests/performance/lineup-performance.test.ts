// @vitest-environment node

import { mkdirSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { optimizeLineup } from "@/services/lineup/lineup-optimizer";

type PerformanceCase = {
  id: string;
  label: string;
  rosterPositions: string[];
  medianBudgetMs: number;
  p95BudgetMs: number;
};

type PerformanceResult = PerformanceCase & {
  candidateCount: number;
  slotCount: number;
  coldStartMs: number;
  medianMs: number;
  p95Ms: number;
  minimumMs: number;
  maximumMs: number;
  warmupIterations: number;
  measuredIterations: number;
  passed: boolean;
};

const CASES: PerformanceCase[] = [
  {
    id: "standard-lineup",
    label: "Standard lineup solve",
    rosterPositions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"],
    medianBudgetMs: 100,
    p95BudgetMs: 150,
  },
  {
    id: "large-idp-lineup",
    label: "Large IDP lineup solve",
    rosterPositions: [
      "QB",
      "RB",
      "RB",
      "WR",
      "WR",
      "TE",
      "SUPER_FLEX",
      "FLEX",
      "DL",
      "DL",
      "LB",
      "LB",
      "LB",
      "DB",
      "DB",
      "IDP_FLEX",
    ],
    medianBudgetMs: 300,
    p95BudgetMs: 450,
  },
];

const positions = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"];
const players = Array.from({ length: 90 }, (_, index) => ({
  playerId: `lineup-${index}`,
  name: `Lineup Player ${index}`,
  eligiblePositions: [positions[index % positions.length] ?? "WR"],
  expectedPoints: 30 - index * 0.1,
  floor: 20 - index * 0.05,
  ceiling: 40 - index * 0.1,
}));

const isCi = process.env.PERFORMANCE_CI === "true";
const warmupIterations = isCi ? 10 : 6;
const measuredIterations = isCi ? 50 : 30;

describe("warmed lineup performance budgets", () => {
  it("reports statistically stable standard and large-IDP timing", () => {
    const results = CASES.map(runCase);
    writeReports(results);

    for (const result of results) {
      expect(result.medianMs, `${result.label} median`).toBeLessThan(
        result.medianBudgetMs,
      );
      expect(result.p95Ms, `${result.label} p95`).toBeLessThan(
        result.p95BudgetMs,
      );
    }
  });
});

function runCase(performanceCase: PerformanceCase): PerformanceResult {
  const run = () =>
    optimizeLineup({
      rosterPositions: performanceCase.rosterPositions,
      players,
    });

  const coldStarted = performance.now();
  const coldSolution = run();
  const coldStartMs = performance.now() - coldStarted;
  expect(coldSolution.emptySlots).toEqual([]);

  for (let index = 0; index < warmupIterations; index += 1) run();

  const samples: number[] = [];
  for (let index = 0; index < measuredIterations; index += 1) {
    const started = performance.now();
    const solution = run();
    samples.push(performance.now() - started);
    expect(solution.emptySlots).toEqual([]);
  }

  const sorted = samples.toSorted((left, right) => left - right);
  const medianMs = percentile(sorted, 0.5);
  const p95Ms = percentile(sorted, 0.95);
  return {
    ...performanceCase,
    candidateCount: players.length,
    slotCount: performanceCase.rosterPositions.length,
    coldStartMs: round(coldStartMs),
    medianMs: round(medianMs),
    p95Ms: round(p95Ms),
    minimumMs: round(sorted[0] ?? 0),
    maximumMs: round(sorted.at(-1) ?? 0),
    warmupIterations,
    measuredIterations,
    passed:
      medianMs < performanceCase.medianBudgetMs &&
      p95Ms < performanceCase.p95BudgetMs,
  };
}

function percentile(sorted: number[], quantile: number): number {
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index] ?? 0;
}

function writeReports(results: PerformanceResult[]): void {
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      architecture: arch(),
      ci: Boolean(process.env.CI),
      coverageInstrumented: false,
      gitSha: process.env.GITHUB_SHA ?? null,
    },
    methodology: {
      deterministicFixture: true,
      fixtureConstructionTimed: false,
      warmupIterations,
      measuredIterations,
      statistics: ["median", "p95", "cold-start"],
    },
    passed: results.every((result) => result.passed),
    results,
  };
  const artifactDirectory = resolve(process.cwd(), "artifacts");
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(
    resolve(artifactDirectory, "performance-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    resolve(artifactDirectory, "performance-report.md"),
    markdownReport(report, results),
    "utf8",
  );
}

function markdownReport(
  report: {
    generatedAt: string;
    environment: { node: string; platform: string; architecture: string };
    passed: boolean;
  },
  results: PerformanceResult[],
): string {
  const rows = results
    .map(
      (result) =>
        `| ${result.label} | ${result.candidateCount} | ${result.slotCount} | ${result.coldStartMs} | ${result.medianMs} / ${result.medianBudgetMs} | ${result.p95Ms} / ${result.p95BudgetMs} | ${result.passed ? "PASS" : "FAIL"} |`,
    )
    .join("\n");
  return `# Performance report

Generated: ${report.generatedAt}

Environment: ${report.environment.node} on ${report.environment.platform}/${report.environment.architecture}. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, ${warmupIterations} warmups, ${measuredIterations} measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

Overall: **${report.passed ? "PASS" : "FAIL"}**
`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
