# Performance report

Generated: 2026-08-03T00:36:20.288Z

Environment: v24.14.0 on win32/x64. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, 10 warmups, 50 measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard lineup solve | 90 | 9 | 15.126 | 1.892 / 100 | 2.451 / 150 | PASS |
| Large IDP lineup solve | 90 | 16 | 7.776 | 8.102 / 300 | 10.277 / 450 | PASS |

Overall: **PASS**
