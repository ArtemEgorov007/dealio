# SQL badge ingestion and hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make staging SQL badges safe to operate while Google Sheets remains the catalog authoring source.

**Architecture:** A private PHP synchronizer fetches the existing GAS badge-read contract and atomically reconciles active SQL catalog rows. PHP API authorization derives scope from the authenticated user. Migrations run in sorted order and the temporary bootstrap is removed.

**Tech Stack:** Nuxt 4, TypeScript, PHP 8.3, PDO/MySQL 8, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-27-sql-badges-ingest-and-hardening-design.md`

## Global Constraints

- Staging only; production remains GAS.
- No plaintext credentials or bootstrap tokens in source or browser bundles.
- Catalog sync never deletes historical badge issues.
- Every new behavior starts with a failing test.

---

### Task 1: Migration and catalog lifecycle

**Files:**
- Modify: `database/migrations/002_erp_badges.sql`
- Create: `database/migrations/004_erp_catalog_sync.sql`
- Modify: `scripts/sql-migrate.php`
- Test: `tests/sql-badge-sync-contract.test.mjs`

- [x] Write failing migration-discovery and active-catalog tests.
- [x] Run the targeted test and confirm it fails.
- [x] Add active/archive fields and the sync-run audit table; make the runner load every numbered migration once, in order.
- [x] Run targeted and complete verification.

### Task 2: Private Google-to-SQL synchronizer

**Files:**
- Create: `public/api/src/BadgeCatalogSync.php`
- Modify: `public/api/src/BadgeImport.php`
- Create: `scripts/sql-sync-workshop-badges.php`
- Test: `tests/php/badge-catalog-sync-test.php`

- [x] Write failing tests for snapshot reconciliation, failure preservation, and an audit result without badge contents.
- [x] Run the PHP test and confirm it fails.
- [x] Implement transactional reconcile and private-config source reader.
- [x] Run targeted and complete verification.

### Task 3: Server-side operational safeguards

**Files:**
- Modify: `public/api/src/Badges.php`
- Modify: `public/api/src/Handover.php`
- Test: `tests/php/badge-authorization-test.php`

- [x] Write failing tests for catalog membership and executor/manager scope.
- [x] Run the PHP test and confirm it fails.
- [x] Implement catalog membership checks and authenticated-role scoping.
- [x] Run targeted and complete verification.

### Task 4: Remove unsafe staging bootstrap and document deployment

**Files:**
- Delete: `public/api/_bootstrap_sql.php`
- Modify: `docs/sql-staging-qa.md`
- Create: `docs/sql-staging-deploy-runbook.md`
- Test: `tests/php-api-shell-contract.test.mjs`

- [x] Write failing contract test forbidding a public bootstrap and hardcoded secrets.
- [x] Run the targeted test and confirm it fails.
- [x] Remove the file, add a non-secret deployment runbook, and update QA status to pending live verification.
- [x] Run complete verification.

### Task 5: Staging deployment and QA gate

**Files:**
- Modify: `docs/sql-staging-qa.md`

- [x] Prepare the private host configuration and deploy staging only after an action-time confirmation for the credential upload.
- [x] Run all migrations and a transactional catalog sync.
- [x] Run authenticated staging QA for catalog, issue, delete, scope, handover, and refresh session.
- [x] Record objective results; do not mark production-ready or change production mode.
