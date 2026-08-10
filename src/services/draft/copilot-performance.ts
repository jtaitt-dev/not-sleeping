export type DraftCopilotTimingSample = {
  stateHash: string;
  precedingPickAt: number;
  localBoardStartedAt: number;
  localBoardReadyAt: number;
  shortlistReadyAt: number;
  researchStartedAt?: number;
  aiJobStartedAt?: number;
  aiReadyAt?: number;
  userClockStartedAt?: number;
};

export type DraftCopilotTimingMeasurement = {
  stateHash: string;
  precedingPickToLocalBoardMs: number;
  localBoardLatencyMs: number;
  shortlistLatencyMs: number;
  researchStartLatencyMs: number | null;
  aiJobStartLatencyMs: number | null;
  aiCompletionLatencyMs: number | null;
  precedingPickToAiReadyMs: number | null;
  readyBeforeUserClock: boolean | null;
};

export type DraftCopilotPerformanceSummary = {
  samples: number;
  localBoardLatencyMs: Percentiles;
  shortlistLatencyMs: Percentiles;
  researchStartLatencyMs: Percentiles | null;
  aiJobStartLatencyMs: Percentiles | null;
  aiCompletionLatencyMs: Percentiles | null;
  precedingPickToLocalBoardMs: Percentiles;
  precedingPickToAiReadyMs: Percentiles | null;
  userPicksWithClockEvidence: number;
  readyBeforeUserClock: number;
  readyBeforeUserClockRate: number | null;
};

type Percentiles = {
  median: number;
  p95: number;
};

const MAX_SAMPLES = 128;

export class DraftCopilotPerformanceTracker {
  private readonly samples = new Map<string, DraftCopilotTimingSample>();

  begin(sample: DraftCopilotTimingSample): void {
    this.samples.set(sample.stateHash, structuredClone(sample));
    while (this.samples.size > MAX_SAMPLES) {
      const oldest = this.samples.keys().next();
      if (oldest.done) break;
      this.samples.delete(oldest.value);
    }
  }

  mark(
    stateHash: string,
    event:
      | "researchStartedAt"
      | "aiJobStartedAt"
      | "aiReadyAt"
      | "userClockStartedAt",
    timestamp: number,
  ): void {
    const sample = this.samples.get(stateHash);
    if (!sample) return;
    this.samples.set(stateHash, { ...sample, [event]: timestamp });
  }

  measurements(): DraftCopilotTimingMeasurement[] {
    return [...this.samples.values()].map(measureDraftCopilotTiming);
  }

  summary(): DraftCopilotPerformanceSummary {
    return summarizeDraftCopilotPerformance(this.measurements());
  }

  clear(): void {
    this.samples.clear();
  }
}

export const draftCopilotPerformanceTracker =
  new DraftCopilotPerformanceTracker();

export function measureDraftCopilotTiming(
  sample: DraftCopilotTimingSample,
): DraftCopilotTimingMeasurement {
  return {
    stateHash: sample.stateHash,
    precedingPickToLocalBoardMs: duration(
      sample.precedingPickAt,
      sample.localBoardReadyAt,
    ),
    localBoardLatencyMs: duration(
      sample.localBoardStartedAt,
      sample.localBoardReadyAt,
    ),
    shortlistLatencyMs: duration(
      sample.localBoardReadyAt,
      sample.shortlistReadyAt,
    ),
    researchStartLatencyMs: optionalDuration(
      sample.precedingPickAt,
      sample.researchStartedAt,
    ),
    aiJobStartLatencyMs: optionalDuration(
      sample.precedingPickAt,
      sample.aiJobStartedAt,
    ),
    aiCompletionLatencyMs:
      sample.aiJobStartedAt === undefined
        ? null
        : optionalDuration(sample.aiJobStartedAt, sample.aiReadyAt),
    precedingPickToAiReadyMs: optionalDuration(
      sample.precedingPickAt,
      sample.aiReadyAt,
    ),
    readyBeforeUserClock:
      sample.aiReadyAt === undefined || sample.userClockStartedAt === undefined
        ? null
        : sample.aiReadyAt <= sample.userClockStartedAt,
  };
}

export function summarizeDraftCopilotPerformance(
  measurements: DraftCopilotTimingMeasurement[],
): DraftCopilotPerformanceSummary {
  const clockEvidence = measurements.flatMap((measurement) =>
    measurement.readyBeforeUserClock === null
      ? []
      : [measurement.readyBeforeUserClock],
  );
  const readyBeforeUserClock = clockEvidence.filter(Boolean).length;
  return {
    samples: measurements.length,
    localBoardLatencyMs: percentiles(
      measurements.map((measurement) => measurement.localBoardLatencyMs),
    ),
    shortlistLatencyMs: percentiles(
      measurements.map((measurement) => measurement.shortlistLatencyMs),
    ),
    researchStartLatencyMs: optionalPercentiles(
      measurements.map((measurement) => measurement.researchStartLatencyMs),
    ),
    aiJobStartLatencyMs: optionalPercentiles(
      measurements.map((measurement) => measurement.aiJobStartLatencyMs),
    ),
    aiCompletionLatencyMs: optionalPercentiles(
      measurements.map((measurement) => measurement.aiCompletionLatencyMs),
    ),
    precedingPickToLocalBoardMs: percentiles(
      measurements.map(
        (measurement) => measurement.precedingPickToLocalBoardMs,
      ),
    ),
    precedingPickToAiReadyMs: optionalPercentiles(
      measurements.map((measurement) => measurement.precedingPickToAiReadyMs),
    ),
    userPicksWithClockEvidence: clockEvidence.length,
    readyBeforeUserClock,
    readyBeforeUserClockRate:
      clockEvidence.length === 0
        ? null
        : readyBeforeUserClock / clockEvidence.length,
  };
}

function duration(start: number, end: number): number {
  return Math.max(0, end - start);
}

function optionalDuration(
  start: number,
  end: number | undefined,
): number | null {
  return end === undefined ? null : duration(start, end);
}

function optionalPercentiles(values: Array<number | null>): Percentiles | null {
  const available = values.flatMap((value) => (value === null ? [] : [value]));
  return available.length === 0 ? null : percentiles(available);
}

function percentiles(values: number[]): Percentiles {
  if (values.length === 0) return { median: 0, p95: 0 };
  const sorted = values.toSorted((left, right) => left - right);
  return {
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  };
}

function percentile(sorted: number[], quantile: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index] ?? 0;
}
