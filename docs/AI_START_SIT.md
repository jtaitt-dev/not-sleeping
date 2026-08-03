# AI Start/Sit

The exact legal-lineup optimizer owns slot eligibility, locks, exclusions,
inactive status, and empty-slot detection. Best Ball is modeled separately and
never suggests a manual lineup move when Sleeper chooses the scoring lineup.

The AI overlay receives only valid local candidates and compact decision facts.
It may explain a close call or surface a risk but cannot place an illegal player
in a slot. Injury/status metadata changes invalidate relevant evidence. Provider
failure leaves the legal local lineup visible.
