# Historical database backup — not an active data source

`igt_data-copy-pre-036.db` was previously `igt_data - 副本.db` in the project root.
It contains 738 Practice questions and the pre-036 schema. It was moved here on
2026-10-04 to prevent confusion, with its bytes and any SQLite sidecars preserved.

Do not configure the application, generate seeds, or calibrate tests from this
backup. The configured, actual project `igt_data.db` is authoritative. Preserve
this file for recovery; do not synchronize it back into the active database.
