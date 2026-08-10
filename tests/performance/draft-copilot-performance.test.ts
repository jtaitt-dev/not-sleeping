import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DraftCopilotPerformanceTracker,
  measureDraftCopilotTiming,
} from "@/services/draft/copilot-performance";

describe("Draft Copilot performance instrumentation", () => {
  it("measures every preparation milestone and readiness before the clock", async () => {
    const tracker = new DraftCopilotPerformanceTracker();
    tracker.begin({
      stateHash: "ready-before-clock",
      precedingPickAt: 1_000,
      localBoardStartedAt: 1_001,
      localBoardReadyAt: 1_005,
      shortlistReadyAt: 1_007,
      researchStartedAt: 1_008,
      aiJobStartedAt: 1_012,
      aiReadyAt: 1_080,
      userClockStartedAt: 1_100,
    });
    tracker.begin({
      stateHash: "ready-after-clock",
      precedingPickAt: 2_000,
      localBoardStartedAt: 2_002,
      localBoardReadyAt: 2_008,
      shortlistReadyAt: 2_010,
      researchStartedAt: 2_012,
      aiJobStartedAt: 2_020,
      aiReadyAt: 2_140,
      userClockStartedAt: 2_120,
    });

    const measurements = tracker.measurements();
    const summary = tracker.summary();
    expect(measurements[0]).toMatchObject({
      localBoardLatencyMs: 4,
      shortlistLatencyMs: 2,
      researchStartLatencyMs: 8,
      aiJobStartLatencyMs: 12,
      aiCompletionLatencyMs: 68,
      precedingPickToAiReadyMs: 80,
      readyBeforeUserClock: true,
    });
    expect(summary).toMatchObject({
      samples: 2,
      userPicksWithClockEvidence: 2,
      readyBeforeUserClock: 1,
      readyBeforeUserClockRate: 0.5,
    });

    const artifacts = resolve(process.cwd(), "artifacts");
    await mkdir(artifacts, { recursive: true });
    const report = {
      generatedAt: new Date().toISOString(),
      mode: "deterministic instrumentation-contract fixture",
      summary,
      measurements,
      limitations: [
        "The fixture validates timing arithmetic and readiness classification; it is not a production AI-latency benchmark.",
        "The shipped Draft Copilot tracker records the same milestones from real board, Sleeper-context, AI-start, AI-ready, and clock events.",
      ],
    };
    await writeFile(
      resolve(artifacts, "draft-copilot-performance.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      resolve(artifacts, "draft-copilot-performance.md"),
      renderMarkdown(report),
      "utf8",
    );
  });

  it("uses null for milestones that have not occurred", () => {
    expect(
      measureDraftCopilotTiming({
        stateHash: "local-only",
        precedingPickAt: 10,
        localBoardStartedAt: 11,
        localBoardReadyAt: 13,
        shortlistReadyAt: 14,
      }),
    ).toMatchObject({
      researchStartLatencyMs: null,
      aiJobStartLatencyMs: null,
      aiCompletionLatencyMs: null,
      precedingPickToAiReadyMs: null,
      readyBeforeUserClock: null,
    });
  });
});

function renderMarkdown(report: {
  generatedAt: string;
  mode: string;
  summary: ReturnType<DraftCopilotPerformanceTracker["summary"]>;
  limitations: string[];
}): string {
  const { summary } = report;
  return `# Draft Copilot performance instrumentation

Generated: ${report.generatedAt}

Mode: ${report.mode}

| Metric | Median ms | p95 ms |
| --- | ---: | ---: |
| Local board | ${summary.localBoardLatencyMs.median} | ${summary.localBoardLatencyMs.p95} |
| Shortlist after local board | ${summary.shortlistLatencyMs.median} | ${summary.shortlistLatencyMs.p95} |
| Context/research preparation start | ${summary.researchStartLatencyMs?.median ?? "n/a"} | ${summary.researchStartLatencyMs?.p95 ?? "n/a"} |
| AI job start | ${summary.aiJobStartLatencyMs?.median ?? "n/a"} | ${summary.aiJobStartLatencyMs?.p95 ?? "n/a"} |
| AI completion | ${summary.aiCompletionLatencyMs?.median ?? "n/a"} | ${summary.aiCompletionLatencyMs?.p95 ?? "n/a"} |
| Preceding pick to AI ready | ${summary.precedingPickToAiReadyMs?.median ?? "n/a"} | ${summary.precedingPickToAiReadyMs?.p95 ?? "n/a"} |

Ready before clock: ${summary.readyBeforeUserClock}/${summary.userPicksWithClockEvidence} fixture samples (${Math.round((summary.readyBeforeUserClockRate ?? 0) * 100)}%).

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}
