# SQL staging deployment runbook

## Preconditions

- Production remains `erpBackendMode=gas`.
- A backup/export of the staging database exists.
- The private configuration is stored outside both site document roots and is
  readable only by the PHP user.
- The configuration provides `db.dsn`, `db.user`, `db.password`, and
  `badges.gas_url`. No values are committed to Git.

## Deploy order

1. Run the local verification gate:

```bash
npm run test:contract
php tests/php/approvals-test.php
php tests/php/approvals-authorization-test.php
php tests/php/api-shell-test.php
```

2. Upload the PHP API and migration files to staging only. Keep operations
   scripts outside the document root, for example `erp-ops/scripts` and
   `erp-ops/migrations`.

```bash
export ERP_FTP_HOST='…'
export ERP_FTP_USER='…'
export ERP_FTP_PASSWORD='…'
python3 scripts/deploy-staging-api.py
python3 scripts/staging-approvals-auth-smoke.py
```
3. Run `ERP_API_SRC=/absolute/path/to/staging/api/src php /absolute/path/to/erp-ops/scripts/sql-migrate.php`
   through the server shell. Migrations are applied by the database connection itself
   (`erp_database`), so this step verifies rather than performs them: it prints
   `applied/total` and exits non-zero if any migration is missing. Do not continue on a
   non-zero exit — the schema the API expects is not the schema on the server.
4. Run `ERP_API_SRC=/absolute/path/to/staging/api/src php /absolute/path/to/erp-ops/scripts/sql-import-workshop-badges.php`; retain its JSON result as
   the initial catalog-sync audit record.
5. Confirm the sync report has the expected workshop counts and no error.
6. Run authenticated staging QA for login restoration, personnel, catalog,
   issue, delete, handover, executor scope, manager scope, and rollback.

## Catalog bridge schedule

On staging, run the import every 15 minutes with a non-blocking `flock` lock
and log it outside the document root. The import is one-way: Google Sheets is
the catalog authoring source; SQL receives a reconciled operational copy.
Review the last `erp_catalog_sync_runs` row and the operations log after a
source-table change. Do not enable the schedule on production until the
separate production gate is approved.

## Notification schedules

Two notification jobs run on a schedule. Neither is triggered by user
activity, so an unscheduled job fails silently — nobody gets notified and
nothing errors.

| Job | Script | HTTP route | What it sends |
| --- | --- | --- | --- |
| Pending approvals | `scripts/push-notify-approvals.php` | `POST /api/internal/push-notify` | Reminds approvers of invoices awaiting their decision |
| Supply status changes | `scripts/supply-notify-status.php` | `POST /api/internal/supply-notify-status` | Tells a supply request's author that its status changed |

Run either as a CLI job (preferred — no token needed, it reads the private
config directly) or over HTTP with the `X-Cron-Token` header matching
`push.cron_token` in `erp-api-config.php`. Every 5 minutes is enough for both;
they are idempotent, so an overlapping run sends nothing twice.

The supply job detects a change by comparing `status` against
`notified_status` on `erp_supply_requests`. It marks a request notified even
when delivery fails, so a broken push endpoint costs one missed message
rather than a permanent retry loop. New requests are created with
`notified_status` already set, so ordering never notifies the author of the
status they just saw on screen.

## Rollback

Set staging `erpBackendMode=gas` and redeploy the static frontend. SQL tables
and audit history remain intact for investigation; do not delete them as part
of rollback.
