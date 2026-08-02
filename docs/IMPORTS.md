# Imports

Data Center accepts CSV and JSON ranking, projection, ADP, value, and metadata
sources. Processing is local.

Limits:

- 5 MB file
- 20,000 rows
- 80 columns
- 2,000 characters per field
- JSON depth 8
- CSV or JSON only

Executable and archive signatures are rejected. CSV/JSON values must be scalar.
Recognized fields include player/Sleeper IDs, name, team, position, rank,
positional rank, tier, ADP, projected points, redraft/dynasty/rookie values,
strategy values, age, draft capital, source, and update time.

Identity resolution prioritizes exact Sleeper ID, then normalized name with
position, team, college, and NFL draft-year evidence. Ambiguous candidates are
not silently selected.

CSV exports prefix formula-leading cells (`=`, `+`, `-`, `@`) to prevent
spreadsheet formula injection.
