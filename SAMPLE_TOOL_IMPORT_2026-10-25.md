# Generated sample tools

25 October 2026, Asia/Manila.

Added 300 dummy tools to the operational inventory used by `custodian@labtrack.local`. All are marked **good** and **available**, with description **Sample tool for testing.** The original 20 tools in the separate sample scope are preserved.

| Category | Tool types | Units |
| --- | ---: | ---: |
| Hand Tools | 12 | 120 |
| Measuring & Inspection | 8 | 80 |
| Electrical Tools | 4 | 40 |
| Aircraft Maintenance | 3 | 30 |
| Workshop Equipment | 3 | 30 |
| Total | 30 | 300 |

The importer assigns asset codes `SAMPLE26-001` through `SAMPLE26-300` and lets PostgreSQL generate unique QR tokens. `SAMPLE26` is reserved for this import; use another code prefix when adding real equipment through the app. All new records share one creation batch, identified in the private receipt, so they remain distinguishable from physical equipment entered later.

The owner-only script `scripts/add-sample-tools.mjs` previews by default. With `--apply` it inserts only missing codes, in one atomic statement. It checks the intended active custodian, scope and known Supabase project first. It does not reset users, change passwords, alter existing tools or create borrowing transactions.

Verification passed: 300 new operational records, all 300 QR tokens unique across the entire inventory; full-row SHA-256 comparisons confirm every original tool and all profile/transaction/item rows are unchanged. Total database inventory is 320, comprising 300 operational dummy tools and the original 20 sample-scope tools. A repeat preview reports zero additions and 300 already present.

Private before/after checksums, inserted IDs, asset codes and the batch ID are recorded under `output/private/sample-tools-2026-10-25/`. These receipts are ignored by Git. This is a real database import of fictional records, not evidence of 300 physical tools.
