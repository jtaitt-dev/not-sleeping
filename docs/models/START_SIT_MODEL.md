# Start/sit model

Pipeline: league-scored baseline → availability → usage/role → matchup → weather → injury/news → roster context → risk strategy → exact lineup solve. Each component has a fixed bound. Missing input contributes zero and reduces confidence; contradictory or stale evidence also reduces confidence. Output includes floor, median, ceiling, boom/bust, pending news, and citations. Exact assignment—not a greedy per-slot loop—determines the final legal lineup.
