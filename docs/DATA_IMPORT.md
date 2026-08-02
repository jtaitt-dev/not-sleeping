# Data Import

Data Center accepts local CSV and JSON rankings, projections, ADP, dynasty
values, rookie values, and metadata. Files are parsed in a worker, validated,
normalized, previewed, and committed only after the user confirms.

Limits are 5 MB, 20,000 rows, 80 columns, 2,000 characters per field, and JSON
depth 8. Executable/archive signatures and non-scalar values are rejected.
Identity resolution prefers Sleeper ID, then name plus position, team, college,
and draft-year evidence; ambiguous records require review.

Exports protect formula-leading CSV cells and exclude credentials and private
diagnostic fields. Imports stay local. See [the field reference and safety
details](IMPORTS.md).
