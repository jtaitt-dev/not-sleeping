export type HistoricalPlayerWeek = {
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  fantasyPointsPpr: number;
};

export type BacktestReport = {
  generatedAt: string;
  dataPolicy: {
    source: string;
    seasons: number[];
    leakageRule: string;
    limitations: string[];
  };
  startSit: {
    decisions: number;
    accuracy: number;
    closeCallAccuracy: number | null;
    nonCloseCallAccuracy: number | null;
    meanRegret: number;
    floorMae: number;
    medianMae: number;
    ceilingMae: number;
    splits: Record<string, { decisions: number; accuracy: number }>;
  };
  waivers: {
    candidates: number;
    trueBreakouts: number;
    precision: number | null;
    falsePositiveRate: number | null;
    shortTermMeanLift: number | null;
    dynastyStashes: "not_available_in_fixture";
  };
  draft: {
    seasonTransitions: number;
    baseline: string;
    selectedPlayerCount: number;
    valueCaptureRatio: number | null;
    replacementValue: number | null;
    positionAllocation: Record<string, number>;
    historicalAdpAvailable: false;
  };
};

type Decision = {
  season: number;
  week: number;
  position: string;
  correct: boolean;
  close: boolean;
  regret: number;
  floorError: number;
  medianError: number;
  ceilingError: number;
};

export function runWalkForwardBacktests(
  rows: HistoricalPlayerWeek[],
  generatedAt = new Date().toISOString(),
): BacktestReport {
  validateRows(rows);
  const seasons = [...new Set(rows.map((row) => row.season))].toSorted();
  return {
    generatedAt,
    dataPolicy: {
      source: "Recorded nflverse weekly player-stats fixture (CC-BY-4.0)",
      seasons,
      leakageRule:
        "A decision for season S, week W may use only rows from S with week < W; draft baselines use only prior seasons.",
      limitations: [
        "The recorded fixture is intentionally small and is an engineering validation, not a production accuracy study.",
        "Historical ADP is not present, so the draft test uses prior-season fantasy points and labels that proxy explicitly.",
        "Hindsight optimal lineups are used only to calculate regret and are not presented as achievable forecasts.",
      ],
    },
    startSit: startSitBacktest(rows),
    waivers: waiverBacktest(rows),
    draft: draftBacktest(rows),
  };
}

export function startSitBacktest(
  rows: HistoricalPlayerWeek[],
): BacktestReport["startSit"] {
  const decisions: Decision[] = [];
  const keys = [
    ...new Set(rows.map((row) => `${row.season}:${row.week}:${row.position}`)),
  ];
  for (const key of keys) {
    const [seasonText, weekText, position] = key.split(":");
    const season = Number(seasonText);
    const week = Number(weekText);
    if (week <= 1 || !position) continue;
    const current = rows.filter(
      (row) =>
        row.season === season && row.week === week && row.position === position,
    );
    if (current.length < 2) continue;
    const candidates = current.flatMap((row) => {
      const history = rows
        .filter(
          (prior) =>
            prior.season === season &&
            prior.week < week &&
            prior.playerId === row.playerId,
        )
        .map((prior) => prior.fantasyPointsPpr);
      if (!history.length) return [];
      return [{ row, history, projection: mean(history) }];
    });
    if (candidates.length < 2) continue;
    const recommended = candidates.toSorted(
      (left, right) => right.projection - left.projection,
    )[0];
    const hindsight = candidates.toSorted(
      (left, right) => right.row.fantasyPointsPpr - left.row.fantasyPointsPpr,
    )[0];
    const runnerUp = candidates.toSorted(
      (left, right) => right.projection - left.projection,
    )[1];
    if (!recommended || !hindsight || !runnerUp) continue;
    const distribution = recommended.history.toSorted(
      (left, right) => left - right,
    );
    decisions.push({
      season,
      week,
      position,
      correct: recommended.row.playerId === hindsight.row.playerId,
      close: Math.abs(recommended.projection - runnerUp.projection) < 2,
      regret: Math.max(
        0,
        hindsight.row.fantasyPointsPpr - recommended.row.fantasyPointsPpr,
      ),
      floorError: Math.abs(
        percentile(distribution, 0.25) - recommended.row.fantasyPointsPpr,
      ),
      medianError: Math.abs(
        mean(distribution) - recommended.row.fantasyPointsPpr,
      ),
      ceilingError: Math.abs(
        percentile(distribution, 0.75) - recommended.row.fantasyPointsPpr,
      ),
    });
  }
  const close = decisions.filter((decision) => decision.close);
  const nonClose = decisions.filter((decision) => !decision.close);
  const splitKeys = [
    ...new Set(
      decisions.flatMap((decision) => [
        `season:${decision.season}`,
        `position:${decision.position}`,
        `week:${decision.week}`,
      ]),
    ),
  ];
  return {
    decisions: decisions.length,
    accuracy:
      ratio(
        decisions.filter((decision) => decision.correct).length,
        decisions.length,
      ) ?? 0,
    closeCallAccuracy: ratio(
      close.filter((decision) => decision.correct).length,
      close.length,
    ),
    nonCloseCallAccuracy: ratio(
      nonClose.filter((decision) => decision.correct).length,
      nonClose.length,
    ),
    meanRegret: mean(decisions.map((decision) => decision.regret)),
    floorMae: mean(decisions.map((decision) => decision.floorError)),
    medianMae: mean(decisions.map((decision) => decision.medianError)),
    ceilingMae: mean(decisions.map((decision) => decision.ceilingError)),
    splits: Object.fromEntries(
      splitKeys.map((key) => {
        const [kind, value] = key.split(":");
        const subset = decisions.filter(
          (decision) =>
            String(decision[kind as "season" | "week" | "position"]) === value,
        );
        return [
          key,
          {
            decisions: subset.length,
            accuracy:
              ratio(
                subset.filter((decision) => decision.correct).length,
                subset.length,
              ) ?? 0,
          },
        ];
      }),
    ),
  };
}

export function waiverBacktest(
  rows: HistoricalPlayerWeek[],
): BacktestReport["waivers"] {
  const evaluations: { breakout: boolean; lift: number }[] = [];
  for (const row of rows) {
    if (row.week < 3) continue;
    const prior = rows.filter(
      (candidate) =>
        candidate.season === row.season &&
        candidate.playerId === row.playerId &&
        candidate.week < row.week,
    );
    if (prior.length < 2) continue;
    const priorWithoutLatest = prior.slice(0, -1);
    const trigger = prior.at(-1);
    if (!trigger || !priorWithoutLatest.length) continue;
    const baseline = mean(
      priorWithoutLatest.map((candidate) => candidate.fantasyPointsPpr),
    );
    if (trigger.fantasyPointsPpr < Math.max(8, baseline * 1.25)) continue;
    const future = rows.filter(
      (candidate) =>
        candidate.season === row.season &&
        candidate.playerId === row.playerId &&
        candidate.week >= row.week &&
        candidate.week <= row.week + 2,
    );
    if (!future.length) continue;
    const futureMean = mean(
      future.map((candidate) => candidate.fantasyPointsPpr),
    );
    evaluations.push({
      breakout: futureMean >= baseline * 1.15,
      lift: futureMean - baseline,
    });
  }
  const trueBreakouts = evaluations.filter(
    (evaluation) => evaluation.breakout,
  ).length;
  return {
    candidates: evaluations.length,
    trueBreakouts,
    precision: ratio(trueBreakouts, evaluations.length),
    falsePositiveRate: ratio(
      evaluations.length - trueBreakouts,
      evaluations.length,
    ),
    shortTermMeanLift: evaluations.length
      ? mean(evaluations.map((evaluation) => evaluation.lift))
      : null,
    dynastyStashes: "not_available_in_fixture",
  };
}

export function draftBacktest(
  rows: HistoricalPlayerWeek[],
): BacktestReport["draft"] {
  const seasons = [...new Set(rows.map((row) => row.season))].toSorted();
  let transitions = 0;
  let selectedCount = 0;
  const capture: number[] = [];
  const replacement: number[] = [];
  const positions: Record<string, number> = {};
  for (let index = 1; index < seasons.length; index += 1) {
    const priorSeason = seasons[index - 1];
    const season = seasons[index];
    const priorTotals = playerTotals(
      rows.filter((row) => row.season === priorSeason),
    );
    const actualTotals = playerTotals(
      rows.filter((row) => row.season === season),
    );
    const available = [...priorTotals.entries()].filter(([playerId]) =>
      actualTotals.has(playerId),
    );
    if (available.length < 2) continue;
    transitions += 1;
    const selected = available
      .toSorted((left, right) => right[1] - left[1])
      .slice(0, Math.ceil(available.length / 2));
    const selectedActual = selected.map(
      ([playerId]) => actualTotals.get(playerId) ?? 0,
    );
    const allActual = available.map(
      ([playerId]) => actualTotals.get(playerId) ?? 0,
    );
    selectedCount += selected.length;
    capture.push(mean(selectedActual) / Math.max(0.01, mean(allActual)));
    replacement.push(
      mean(selectedActual) -
        percentile(
          allActual.toSorted((left, right) => left - right),
          0.5,
        ),
    );
    for (const [playerId] of selected) {
      const position =
        rows.find((row) => row.playerId === playerId)?.position ?? "Unknown";
      positions[position] = (positions[position] ?? 0) + 1;
    }
  }
  return {
    seasonTransitions: transitions,
    baseline: "Prior-season PPR fantasy points; explicitly not historical ADP",
    selectedPlayerCount: selectedCount,
    valueCaptureRatio: capture.length ? mean(capture) : null,
    replacementValue: replacement.length ? mean(replacement) : null,
    positionAllocation: positions,
    historicalAdpAvailable: false,
  };
}

export function backtestReportMarkdown(report: BacktestReport): string {
  return [
    "# Phase 2 model validation report",
    "",
    `Generated: ${report.generatedAt}`,
    `Data: ${report.dataPolicy.source} · seasons ${report.dataPolicy.seasons.join(", ")}`,
    "",
    "## Start/sit walk-forward",
    "",
    `- Decisions: ${report.startSit.decisions}`,
    `- Accuracy: ${(report.startSit.accuracy * 100).toFixed(1)}%`,
    `- Mean regret versus hindsight optimum: ${report.startSit.meanRegret.toFixed(2)} PPR points`,
    `- Floor / median / ceiling MAE: ${report.startSit.floorMae.toFixed(2)} / ${report.startSit.medianMae.toFixed(2)} / ${report.startSit.ceilingMae.toFixed(2)}`,
    "",
    "## Waiver replay",
    "",
    `- Candidates: ${report.waivers.candidates}`,
    `- Precision: ${formatOptionalRatio(report.waivers.precision)}`,
    `- False-positive rate: ${formatOptionalRatio(report.waivers.falsePositiveRate)}`,
    "",
    "## Draft replay",
    "",
    `- Baseline: ${report.draft.baseline}`,
    `- Season transitions: ${report.draft.seasonTransitions}`,
    `- Value-capture ratio: ${report.draft.valueCaptureRatio?.toFixed(3) ?? "not available"}`,
    "",
    "## Limitations",
    "",
    ...report.dataPolicy.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
}

function validateRows(rows: HistoricalPlayerWeek[]): void {
  if (!rows.length) throw new Error("Historical rows are required.");
  for (const row of rows) {
    if (
      !Number.isInteger(row.season) ||
      !Number.isInteger(row.week) ||
      row.week < 1
    )
      throw new Error("Historical season/week is invalid.");
    if (!Number.isFinite(row.fantasyPointsPpr))
      throw new Error("Historical points must be finite.");
  }
}

function playerTotals(rows: HistoricalPlayerWeek[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows)
    totals.set(
      row.playerId,
      (totals.get(row.playerId) ?? 0) + row.fantasyPointsPpr,
    );
  return totals;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function percentile(values: number[], quantile: number): number {
  if (!values.length) return 0;
  return (
    values[
      Math.min(values.length - 1, Math.floor((values.length - 1) * quantile))
    ] ?? 0
  );
}

function formatOptionalRatio(value: number | null): string {
  return value === null ? "not available" : `${(value * 100).toFixed(1)}%`;
}
