# Phase 2 model validation report

Generated: 2026-08-02T20:55:18.439Z
Data: Recorded nflverse weekly player-stats fixture (CC-BY-4.0) · seasons 2023, 2024

## Start/sit walk-forward

- Decisions: 23
- Accuracy: 52.2%
- Mean regret versus hindsight optimum: 4.38 PPR points
- Floor / median / ceiling MAE: 9.42 / 8.19 / 9.91

## Waiver replay

- Candidates: 14
- Precision: 57.1%
- False-positive rate: 42.9%

## Draft replay

- Baseline: Prior-season PPR fantasy points; explicitly not historical ADP
- Season transitions: 1
- Value-capture ratio: 1.233

## Limitations

- The recorded fixture is intentionally small and is an engineering validation, not a production accuracy study.
- Historical ADP is not present, so the draft test uses prior-season fantasy points and labels that proxy explicitly.
- Hindsight optimal lineups are used only to calculate regret and are not presented as achievable forecasts.
