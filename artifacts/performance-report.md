# Performance report

Generated: 2026-08-02T21:40:54.169Z

Environment: v24.14.0 on win32/x64. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, 10 warmups, 50 measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard lineup solve | 90 | 9 | 17.353 | 2.122 / 100 | 3.209 / 150 | PASS |
| Large IDP lineup solve | 90 | 16 | 8.577 | 9.158 / 300 | 11.257 / 450 | PASS |

Overall: **PASS**
