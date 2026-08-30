# SQL bridge for badge catalog — design

## Status and decision

The current production workflow remains unchanged: operators add new badges to
the Google Sheet. Production stays on GAS. Staging is the only SQL consumer
until the acceptance gate below passes.

Google Sheets is the source of truth for the badge catalog during this bridge.
MySQL is the source of truth for SQL-stage operational events (issue and
handover). This intentionally avoids a cutover that would leave users without
a way to add new badges.

## Scope

1. Add a one-way Google Sheets/GAS-to-SQL catalog synchronizer for the two
   supported workshops.
2. Make it idempotent, auditable, and safe on partial failure.
3. Ensure the issue API accepts only a badge currently present in that
   workshop's SQL catalog.
4. Enforce executor/manager visibility on the server, not through a client
   supplied `fio` query parameter.
5. Make every migration discoverable and runnable in deterministic numeric
   order.
6. Remove the temporary public bootstrap script and never ship test
   credentials or tokens in source.

## Out of scope

- Production SQL cutover.
- Replacing the Google sheet as catalog authoring UI.
- Importing or deleting historical operational records.
- Measurements, packing, warehouse, and unrelated UI redesign.

## Data flow

```text
Google Sheet "Выдача" -> existing GAS read endpoint -> private PHP sync job
-> erp_workshop_badges -> staging SQL badge list
```

The job imports a complete snapshot for each workshop in one transaction. A
badge found in the current snapshot is active; a previously imported badge
absent from the snapshot is soft-archived, never physically deleted. The job
records its result, source counts, target counts, and errors in
`erp_catalog_sync_runs`. A failed fetch or failed transaction preserves the
last known active catalog.

## API rules

- `GET /api/badges` returns active catalog rows only.
- `POST /api/badges/issues` verifies `workshop_id + SHA-256(badge_content)`
  exists and is active before recording an issue.
- For an executor, today's entries are always constrained to the authenticated
  user. A manager may request all entries; `fio` is not an authorization
  control.
- The synchronizer is server-side only. Its source URL and any job token live
  in the private host configuration, never in the frontend bundle or Git.

## Acceptance gate

Staging must demonstrate: a new sheet badge appears after sync; a removed
sheet badge becomes unavailable without deleting history; a failed sync leaves
the prior catalog unchanged; an arbitrary badge cannot be issued; executor and
manager results have correct server-enforced scope; and all three migrations
run from an empty database. Only then can the team discuss a production bridge
deployment. The production setting remains `erpBackendMode=gas` throughout
this work.
