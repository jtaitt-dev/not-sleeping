# Performance report

Generated: 2026-08-09T00:17:05.912Z

Environment: v24.14.0 on win32/x64. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, 10 warmups, 50 measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard lineup solve | 90 | 9 | 16.419 | 2.233 / 100 | 3.013 / 150 | PASS |
| Large IDP lineup solve | 90 | 16 | 8.876 | 8.338 / 300 | 9.877 / 450 | PASS |

Overall: **PASS**
