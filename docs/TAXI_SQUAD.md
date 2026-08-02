# Taxi Squad

Taxi recommendations enforce configured slot count, experience limits, rookie/non-rookie rules, IDP eligibility, deadline overrides, and whether promotion is reversible. The output distinguishes keep, promote, cut, and ineligible states with the reason and eligibility-expiration risk.

Sleeper does not expose every commissioner-specific taxi rule. When a deadline or special eligibility rule is absent, the UI labels it unknown and requires a manual override. No taxi move is performed by the extension.
