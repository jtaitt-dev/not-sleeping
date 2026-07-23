# Valuation Engine

The ranking engine is deterministic and local. It combines source rank, tier,
ADP, projection, replacement level, positional scarcity, roster need, league
scoring, draft mode, age curve, draft capital, risk, and estimated
next-selection availability.

League settings drive format and scoring detection, with confidence,
explanations, and a manual override. Strategy profiles support contender,
balanced, productive-struggle, and rebuild planning. Rookie eligibility,
keepers, traded picks, taxi/IR slots, superflex, 2QB, TE premium, best ball,
and supported IDP positions are represented by typed inputs.

OpenAI is never the ranking source of truth. Cited research may produce a
separately displayed adjustment bounded to ±8 points; uncited output cannot
change the deterministic score. All calculations are pure, testable services.
