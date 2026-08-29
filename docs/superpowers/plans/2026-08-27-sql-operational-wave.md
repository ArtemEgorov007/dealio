# Plan: SQL Operational Wave (staging)

## Wave 1 — Badges (now)

1. Spec: `docs/superpowers/specs/2026-08-27-sql-badges-wave-design.md`
2. Migration `002_erp_badges.sql`
3. PHP `Badges.php` + routes
4. Frontend branches in `erp-api.ts` / `erp-sheets.ts` when `erpBackendMode=sql`
5. Seed catalog from sheet «Выдача»
6. Deploy API + static to `erp-mt.online`
7. Smoke: catalog / issue / today / delete / 403 / prod still gas

## Wave 2 — Handover (now)

1. Spec: `docs/superpowers/specs/2026-08-27-sql-handover-wave-design.md`
2. Migration `003_erp_handover.sql`
3. PHP `Handover.php` + routes
4. Frontend sql branches
5. Deploy + smoke (record / duplicate 409 / today / undo / 403)

## Wave 3 — outline (later)

| Domain | Tables (draft) | Notes |
|--------|----------------|-------|
| Measurements | `erp_measurement_batches` + lines | QR/parse stay client-side |
| Packing | `erp_packing_entries` | platform + machine scope |
| Warehouse | read models first | mutations after measurements+packing stable |

Each wave: migration → API → frontend sql branch → seed → staging smoke → QA doc. Prod stays GAS until explicit cutover.
