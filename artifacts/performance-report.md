# Performance report

Generated: 2026-08-12T06:10:52.048Z

Environment: v24.14.0 on win32/x64. Coverage instrumentation: disabled.

Method: deterministic pre-built fixtures, 10 warmups, 50 measured iterations, median and p95 acceptance.

| Case | Candidates | Slots | Cold ms | Median ms / budget | p95 ms / budget | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard lineup solve | 90 | 9 | 17.964 | 2.136 / 100 | 3.153 / 150 | PASS |
| Large IDP lineup solve | 90 | 16 | 10.591 | 9.369 / 300 | 11.844 / 450 | PASS |

Overall: **PASS**
