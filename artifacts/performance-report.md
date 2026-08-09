# Performance report

Generated: 2026-08-09T01:04:06.460Z

Environment: v24.14.0 on win32/x64. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, 10 warmups, 50 measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard lineup solve | 90 | 9 | 17.327 | 2.195 / 100 | 3.388 / 150 | PASS |
| Large IDP lineup solve | 90 | 16 | 8.171 | 8.844 / 300 | 11.089 / 450 | PASS |

Overall: **PASS**
