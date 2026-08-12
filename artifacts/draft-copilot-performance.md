# Draft Copilot performance instrumentation

Generated: 2026-08-12T06:10:52.586Z

Mode: deterministic instrumentation-contract fixture

| Metric | Median ms | p95 ms |
| --- | ---: | ---: |
| Local board | 4 | 6 |
| Shortlist after local board | 2 | 2 |
| Context/research preparation start | 8 | 12 |
| AI job start | 12 | 20 |
| AI completion | 68 | 120 |
| Preceding pick to AI ready | 80 | 140 |

Ready before clock: 1/2 fixture samples (50%).

## Limitations

- The fixture validates timing arithmetic and readiness classification; it is not a production AI-latency benchmark.
- The shipped Draft Copilot tracker records the same milestones from real board, Sleeper-context, AI-start, AI-ready, and clock events.
