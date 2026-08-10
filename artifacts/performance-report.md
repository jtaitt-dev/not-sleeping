# Performance report

Generated: 2026-08-10T17:30:19.389Z

Environment: v24.14.0 on win32/x64. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, 10 warmups, 50 measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard lineup solve | 90 | 9 | 16.982 | 2.176 / 100 | 2.784 / 150 | PASS |
| Large IDP lineup solve | 90 | 16 | 8.388 | 8.528 / 300 | 9.895 / 450 | PASS |

Overall: **PASS**
