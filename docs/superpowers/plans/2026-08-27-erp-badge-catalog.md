# ERP Badge Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give managers a safe staging UI to create a new title and import its badges into SQL from a pasted line-by-line list.

**Architecture:** A new PHP catalog service owns parsing, manager authorization,
preview and one-transaction import. SQL records the title, imported rows and
batch audit; an origin field prevents the scheduled Google bridge from
archiving ERP-created rows. Nuxt adds a manager-only catalog entry and a
two-step preview/confirm screen while the server remains the authorization
authority.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, PHP 8.3, PDO/MySQL 8, SQLite PHP
unit tests, Node contract tests.

**Spec:** `docs/superpowers/specs/2026-08-27-erp-badge-catalog-design.md`

## Global Constraints

- Staging only; `erp-mt.ru` remains GAS until a separate production decision.
- First release accepts pasted text only: one non-empty badge per line; no CSV.
- Catalog write operations require authenticated role `Менеджер` and permission
  `badges`; client visibility never substitutes for server enforcement.
- Google-created and ERP-created catalog rows have distinct immutable origins.
- Google sync may not archive an ERP-created row.
- No plaintext credentials, Google URLs or employee data in source, tests or
  user-facing documents.
- Use TDD for every production behavior. Do not commit or push without an
  explicit user request.

---

## File structure

| File | Responsibility |
|---|---|
| `database/migrations/005_erp_badge_catalog.sql` | Titles, batch audit and origin/title columns on catalog rows. |
| `public/api/src/BadgeCatalog.php` | Parser, authorization, preview, transactional import and API response formatting. |
| `public/api/src/BadgeCatalogSync.php` | Preserve ERP-origin rows during Google reconciliation and report conflicts. |
| `public/api/src/Router.php`, `public/api/index.php`, `public/api/src/Bootstrap.php` | Route and dispatch the catalog API. |
| `app/utils/erp-api.ts` | Typed SQL client methods for catalog metadata, preview, imports and audit. |
| `app/pages/badge-catalog.vue` | Manager catalog screen and preview-confirm workflow. |
| `app/pages/badges.vue` | Manager-visible entry point to the catalog. |
| `tests/php/badge-catalog-test.php` | Service/transaction/authorization behavior. |
| `tests/php/badge-catalog-sync-test.php` | Google bridge origin preservation and conflict behavior. |
| `tests/php/api-shell-test.php` | New route contract. |
| `tests/badge-catalog-page-contract.test.mjs` | Client route, preview and confirmation contract. |
| `docs/sql-staging-qa.md` | Objective staging import results and rollback record. |

## Task 1: Schema and migration contract

**Files:**
- Create: `database/migrations/005_erp_badge_catalog.sql`
- Modify: `tests/php/migration-runner-test.php`
- Create: `tests/php/badge-catalog-schema-test.php`

**Produces:** MySQL schema with `erp_badge_titles`, `erp_badge_import_batches`,
`erp_workshop_badges.title_id`, `catalog_source`, and `created_by`.

- [ ] **Step 1: Write the failing schema test**

Create SQLite-compatible assertions that require the migration text to declare
the following contracts:

```php
expect_schema(str_contains($migration, 'CREATE TABLE IF NOT EXISTS erp_badge_titles'), 'Titles table is required');
expect_schema(str_contains($migration, 'CREATE TABLE IF NOT EXISTS erp_badge_import_batches'), 'Import audit table is required');
expect_schema(str_contains($migration, 'catalog_source'), 'Badge origin is required');
expect_schema(str_contains($migration, 'title_id'), 'Badge title relation is required');
expect_schema(str_contains($migration, 'idempotency_key'), 'Import idempotency is required');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `php tests/php/badge-catalog-schema-test.php`  
Expected: FAIL because migration `005_erp_badge_catalog.sql` does not exist.

- [ ] **Step 3: Add the numbered migration**

Create tables and columns using `utf8mb4`, FKs to `erp_users` and titles, a
unique active title key `(title_name, platform, workshop_id, status)`, and an
idempotency unique key on import batches. Backfill existing badge rows with
`catalog_source = 'gas'`; leave `title_id` and `created_by` NULL. Add indexes
for `(workshop_id, catalog_source, is_active)` and title/audit listing.

- [ ] **Step 4: Verify GREEN and migration discovery**

Run:

```bash
php tests/php/badge-catalog-schema-test.php
php tests/php/migration-runner-test.php
php -l database/migrations/005_erp_badge_catalog.sql
```

Expected: both PHP tests pass; migration runner discovers 001–005 in order.

- [ ] **Step 5: Review the focused diff**

Run: `git diff --check -- database/migrations/005_erp_badge_catalog.sql tests/php/`  
Do not commit or push without explicit user permission.

## Task 2: Catalog parser and transactional service

**Files:**
- Create: `public/api/src/BadgeCatalog.php`
- Create: `tests/php/badge-catalog-test.php`

**Consumes:** Task 1 schema.

**Produces:**

```php
erp_badge_catalog_parse(string $badgesText): array;
erp_badge_catalog_preview(PDO $pdo, array $input): array;
erp_badge_catalog_import(PDO $pdo, array $actor, array $input): array;
```

The parser returns normalized line entries and structured errors
`array{line:int,code:string}`. Preview returns counts and errors without any
database mutation. Import returns title and batch IDs plus `addedCount`.

- [ ] **Step 1: Write failing service tests**

Cover these real behaviors in SQLite:

```php
$preview = erp_badge_catalog_preview($pdo, [
    'titleName' => 'Титул 42', 'platform' => 'Колпино', 'workshop' => 'kolpino',
    'badgesText' => "A-1\nA-1\n\nB-2",
]);
expect_catalog($preview['canImport'] === false, 'Duplicate and blank input must block import');
expect_catalog($preview['errors'][0]['line'] === 2, 'Preview must identify the duplicate line');

$result = erp_badge_catalog_import($pdo, $manager, $validInput);
expect_catalog($result['addedCount'] === 2, 'Import must write all valid badges');
expect_catalog($pdo->query('SELECT COUNT(*) FROM erp_badge_import_batches')->fetchColumn() === 1, 'Import must be auditable');
```

Also test existing active duplicate rejection, duplicate idempotency replay,
manager-only authorization, and a forced insert failure that leaves zero title,
badge and batch rows from that request.

- [ ] **Step 2: Run the test and verify RED**

Run: `php tests/php/badge-catalog-test.php`  
Expected: FAIL because `BadgeCatalog.php` and its functions do not exist.

- [ ] **Step 3: Implement minimal service logic**

Implement exact server rules:

1. Normalize CRLF/LF, trim each line and retain original 1-based line number.
2. Empty lines are reported as `empty_line`; duplicate normalized hash in the
   submitted text is `duplicate_in_input`; existing active hash in the chosen
   workshop is `duplicate_in_catalog`.
3. Validate title, platform, workshop and 64-character-or-shorter
   idempotency key before opening a transaction.
4. In one PDO transaction, create a running batch, title, ERP-origin badge
   rows and then mark batch completed.
5. On any Throwable, roll back catalog/title rows and persist a failed batch
   only when it can be recorded outside the failed transaction.
6. Replaying a completed idempotency key returns its original result without a
   second title or badge set.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
php tests/php/badge-catalog-test.php
php -l public/api/src/BadgeCatalog.php
```

Expected: all parser, duplicate, transaction and replay assertions pass.

- [ ] **Step 5: Review the focused diff**

Run: `git diff --check -- public/api/src/BadgeCatalog.php tests/php/badge-catalog-test.php`  
Do not commit or push without explicit user permission.

## Task 3: Protect ERP-origin rows in the Google bridge

**Files:**
- Modify: `public/api/src/BadgeCatalogSync.php`
- Modify: `tests/php/badge-catalog-sync-test.php`

**Consumes:** `catalog_source` from Task 1.

**Produces:** Google reconciliation that changes only `gas` rows, preserves
`erp` rows, and records a count-only conflict result without leaking badge
contents into audits.

- [ ] **Step 1: Write failing origin-preservation tests**

Extend the existing SQLite test setup with `catalog_source` and insert an
active ERP-origin row absent from the incoming Google snapshot:

```php
$pdo->prepare('INSERT INTO erp_workshop_badges (workshop_id, badge_hash, badge_content, sort_order, is_active, catalog_source) VALUES (?, ?, ?, ?, 1, ?)')
    ->execute(['kolpino', hash('sha256', 'ERP-1'), 'ERP-1', 9, 'erp']);
erp_reconcile_badge_catalog($pdo, ['kolpino' => ['GAS-1']]);
expect_sync((int) $pdo->query("SELECT is_active FROM erp_workshop_badges WHERE badge_content = 'ERP-1'")->fetchColumn() === 1, 'Google sync must preserve ERP-origin badges');
```

Also assert an incoming Google item matching an ERP-origin hash does not alter
that row’s origin or title relation.

- [ ] **Step 2: Run test and verify RED**

Run: `php tests/php/badge-catalog-sync-test.php`  
Expected: FAIL because current reconciliation archives every absent active row.

- [ ] **Step 3: Implement source-aware reconciliation**

Add `catalog_source = 'gas'` to Google-owned find/restore/archive predicates.
When the same workshop/hash is already ERP-owned, leave it intact, increment a
local conflict counter, and update the sync audit result with that count. Do
not convert an ERP row to Google ownership.

- [ ] **Step 4: Verify GREEN**

Run: `php tests/php/badge-catalog-sync-test.php`  
Expected: existing failure-preservation tests and new ERP-origin tests pass.

- [ ] **Step 5: Review the focused diff**

Run: `git diff --check -- public/api/src/BadgeCatalogSync.php tests/php/badge-catalog-sync-test.php`

## Task 4: HTTP routes and server authorization

**Files:**
- Modify: `public/api/src/Bootstrap.php`
- Modify: `public/api/src/Router.php`
- Modify: `public/api/index.php`
- Modify: `public/api/src/BadgeCatalog.php`
- Modify: `tests/php/api-shell-test.php`

**Consumes:** Task 2 service functions.

**Produces:** authenticated `titles`, `preview`, `imports` and import-audit
routes with manager + `badges` enforcement.

- [ ] **Step 1: Write failing route contract assertions**

Add assertions such as:

```php
expect_same(erp_route('POST', '/badge-catalog/preview')[0] ?? null, 'badge_catalog_preview', 'Preview route must be registered');
expect_same(erp_route('POST', '/badge-catalog/imports')[0] ?? null, 'badge_catalog_import', 'Import route must be registered');
expect_same(erp_route('GET', '/badge-catalog/imports')[0] ?? null, 'badge_catalog_imports', 'Audit route must be registered');
```

Add a unit assertion that `erp_badge_catalog_require_manager()` rejects an
executor and a manager without badge access with the existing forbidden JSON
path.

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `php tests/php/api-shell-test.php`  
Expected: FAIL because catalog routes and helper are absent.

- [ ] **Step 3: Wire request handlers**

Add `erp_badge_catalog_require_manager(PDO $pdo, array $config, string
$requestId): array`, call `erp_require_user`, verify exact role `Менеджер`,
then call `erp_require_permission(..., 'badges', ...)`. Decode JSON with the
same 400 envelope used by Badges.php. Route and dispatch:

```text
GET  /badge-catalog/titles   -> erp_badge_catalog_titles
POST /badge-catalog/preview  -> erp_badge_catalog_preview_http
POST /badge-catalog/imports  -> erp_badge_catalog_import_http
GET  /badge-catalog/imports  -> erp_badge_catalog_imports
```

Return only structured safe fields: title IDs/names, platform/workshop, counts,
batch status and timestamps. Never return database errors or another user’s
raw submitted text.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
php tests/php/api-shell-test.php
php -l public/api/index.php
php -l public/api/src/Router.php
php -l public/api/src/BadgeCatalog.php
```

Expected: route contract and lint pass.

- [ ] **Step 5: Review the focused diff**

Run: `git diff --check -- public/api/index.php public/api/src/ tests/php/api-shell-test.php`

## Task 5: Manager catalog UI and typed API client

**Files:**
- Modify: `app/utils/erp-api.ts`
- Create: `app/pages/badge-catalog.vue`
- Modify: `app/pages/badges.vue`
- Create: `tests/badge-catalog-page-contract.test.mjs`

**Consumes:** Task 4 JSON contracts.

**Produces:** manager-only entry, metadata/title list, paste input, preview,
error list and confirm import with one idempotency key per confirmation.

- [ ] **Step 1: Write failing frontend contract test**

Require explicit SQL client methods and manager-only page behavior:

```js
assert.match(api, /previewBadgeCatalogImportViaApi/)
assert.match(api, /createBadgeCatalogImportViaApi/)
assert.match(page, /Бирки — по одной на строку/)
assert.match(page, /Проверить/)
assert.match(page, /Подтвердить импорт/)
assert.match(page, /employeeStore\.role === 'Менеджер'/)
assert.match(badges, /Каталог/)
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/badge-catalog-page-contract.test.mjs`  
Expected: FAIL because the client methods and page do not exist.

- [ ] **Step 3: Implement the smallest manager workflow**

In `erp-api.ts`, add typed functions that call Task 4 routes with
`erpApiRequest`; do not send credentials or trust client-side role checks.

In `badge-catalog.vue`:

1. redirect/deny display for non-manager UI access;
2. load titles/platform options/audit list on mount;
3. capture title, platform, workshop and textarea;
4. call preview without side effects;
5. render counts and each line error;
6. disable confirmation until `canImport` is true;
7. generate an idempotency key once at confirmation and retain it for explicit
   retry of that same request;
8. refresh titles/audit and clear form only after completed response.

Add a compact `Каталог` action on `badges.vue` only when the local profile
role is `Менеджер`; server enforcement remains mandatory for direct URLs.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --test tests/badge-catalog-page-contract.test.mjs
npx vue-tsc --noEmit
npm run lint
```

Expected: contract test, typecheck and lint have zero errors.

- [ ] **Step 5: Review the focused diff**

Run: `git diff --check -- app/utils/erp-api.ts app/pages/badge-catalog.vue app/pages/badges.vue tests/badge-catalog-page-contract.test.mjs`

## Task 6: Full verification, staging deployment and acceptance record

**Files:**
- Modify: `docs/sql-staging-qa.md`

**Consumes:** Tasks 1–5.

- [ ] **Step 1: Run the complete local gate**

Run:

```bash
php tests/php/migration-runner-test.php
php tests/php/badge-catalog-schema-test.php
php tests/php/badge-catalog-test.php
php tests/php/badge-catalog-sync-test.php
php tests/php/api-shell-test.php
npm run verify
NUXT_PUBLIC_ERP_BACKEND_MODE=sql NUXT_PUBLIC_ERP_API_BASE=/api npm run generate
git diff --check
```

Expected: all tests pass, typecheck succeeds, lint has zero errors (existing
warnings may be recorded separately), and static output exists.

- [ ] **Step 2: Get action-time confirmation before staging mutation**

State the exact actions: upload API/migration/static files to
`erp-mt.online`, run migration 005, create one test title through the UI,
verify it, and archive/clean up only that test title. Do not touch
`erp-mt.ru`.

- [ ] **Step 3: Deploy staging only**

Upload updated API source and migration 005 outside the public config area;
run the deterministic migration runner; deploy the SQL-mode static bundle
without remote deletion. Confirm `erp-mt.ru` marker/mode did not change.

- [ ] **Step 4: Perform acceptance scenarios**

Run all ten spec acceptance scenarios. The live test title must use synthetic
non-production badge values, then be archived rather than hard-deleted so the
audit trail remains intact. Run the scheduled Google sync once afterward and
prove the ERP-origin test rows remain active.

- [ ] **Step 5: Record objective evidence**

Append date, migration result, non-sensitive counts, request outcomes and
remaining limitations to `docs/sql-staging-qa.md`. Do not call the product
production-ready or switch production backend mode.

- [ ] **Step 6: Review final diff**

Run: `git status --short && git diff --check`  
Report changed files and verification output. Do not commit or push without
explicit user permission.

## Plan self-review

| Spec requirement | Plan coverage |
|---|---|
| Title / platform / workshop / pasted list | Tasks 1, 2 and 5 |
| Preview and duplicate errors | Tasks 2 and 5 |
| Atomic confirmed import and audit | Tasks 1, 2 and 6 |
| Manager-only server protection | Task 4 |
| ERP rows survive Google sync | Task 3 |
| SQL staging only and no production cutover | Global constraints and Task 6 |
| Mobile/desktop acceptance | Task 6 |

No CSV, direct catalog editing, SQL-to-Google writes, or production cutover
are introduced by this plan.
