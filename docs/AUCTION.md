# Auction assistant

Auction analysis tracks starting and remaining budget, minimum bid, filled/remaining spots, keeper prices, inflation, baseline value, league-adjusted value, roster-specific value, bargain threshold, overpay threshold, recommended maximum, and legal maximum.

The legal maximum is `remaining budget - minimum bid × remaining spots after the win`. Endgame reserve and budget-floor rules are deterministic and simulation-tested. Not Sleeping never bids or nominates.
