# SQL Staging Foundation Implementation Plan

Goal: deliver a reversible staging-only PHP/MySQL backend for ERP authentication and personnel, without modifying legacy data tables or production traffic.

Architecture: Nuxt remains a static SPA. Staging selects a same-origin PHP router at /api. The router uses PDO and new tables with the erp_ prefix. Existing tables remain read-only migration sources. Sessions are HttpOnly cookies, so the browser never persists an employee password.

Tech stack: Nuxt 4, Vue 3, Pinia, TypeScript, PHP 8.3+, PDO MySQL, MySQL 8, Apache rewrite rules, Node test runner.

Spec: docs/superpowers/specs/2026-08-27-sql-backend-migration-design.md

## Global constraints

- Work only in staging; production retains GAS until a separate release confirmation.
- Never issue UPDATE, DELETE, TRUNCATE, DROP, ALTER, or RENAME against an existing unprefixed table.
- New tables start with erp_ and migrations are idempotent.
- Database configuration lives outside the web root and outside git.
- Passwords use PHP password_hash and are never returned or saved in localStorage.
- Every write requires a server session, permission, same-origin check, audit entry, and idempotency key where it creates an event.

### Task 1: Add the API switch and password-free client session

Files:
- Modify: nuxt.config.ts, .env.example, types/erp.types.ts
- Create: app/utils/erp-api.ts
- Modify: app/utils/erp-sheets.ts, store/erp-employee.store.ts, app/pages/register.vue, app/plugins/erp-init.client.ts
- Test: tests/sql-api-client-contract.test.mjs and tests/erp-session-storage-contract.test.mjs

Interface:
- getErpBackendMode returns gas or sql.
- erpApiRequest sends JSON with credentials include.
- restoreErpEmployee obtains an active profile from GET /auth/me.

- [ ] Write contracts requiring public runtime values erpBackendMode and erpApiBase, credentialed API calls, and no persisted password property.
- [ ] Run node --test tests/sql-api-client-contract.test.mjs tests/erp-session-storage-contract.test.mjs. Expected: fail before implementation.
- [ ] Add NUXT_PUBLIC_ERP_BACKEND_MODE with gas default and NUXT_PUBLIC_ERP_API_BASE with /api default.
- [ ] Implement API login, logout, and me calls. Preserve current GAS behavior when the mode is gas.
- [ ] Remove password from employee store state and localStorage. Startup waits for GET /auth/me; only 401 clears the profile.
- [ ] Run the two contracts, npm run typecheck, and npm run lint. Expected: pass, apart from pre-existing lint warnings.

### Task 2: Build the PHP API shell

Files:
- Create: public/api/.htaccess, public/api/index.php
- Create: public/api/src/Bootstrap.php, public/api/src/Http.php, public/api/src/Router.php, public/api/src/Database.php, public/api/src/Session.php
- Test: tests/php/api-shell-test.php and tests/php-api-shell-contract.test.mjs

Interface:
- Database factory configures PDO exceptions, native prepared statements, and associative fetches.
- Router handles POST /auth/login, POST /auth/logout, and GET /auth/me.
- Errors use JSON with ok false, error code, safe message, and request ID.

- [ ] Write PHP and source contracts for routes, error shape, rewrite behavior, and absence of credentials in public/api.
- [ ] Run php tests/php/api-shell-test.php and node --test tests/php-api-shell-contract.test.mjs. Expected: fail.
- [ ] Add Apache rewrite for non-file /api paths to index.php.
- [ ] Load configuration only from a private file above the web root. Validate required configuration before opening PDO.
- [ ] Implement safe 404, 405, and 500 responses without exception traces.
- [ ] Run php -l on all public/api PHP files plus both shell tests. Expected: pass.

### Task 3: Create non-destructive schema and employee importer

Files:
- Create: database/migrations/001_erp_identity.sql
- Create: scripts/sql-migrate.php and scripts/sql-import-legacy-employees.php
- Test: tests/sql-migration-contract.test.mjs and tests/php/schema-import-test.php

Interface:
- Creates erp_users, erp_user_permissions, erp_sessions, erp_shift_events, and erp_audit_log.
- Importer reports imported, skipped, and duplicate normalized logins.

- [ ] Write contracts that require only erp_ tables, a unique user login, password hash, composite user/permission uniqueness, and hashed session tokens.
- [ ] Write import tests for duplicate logins, retained status, password hashing, and no open password output.
- [ ] Run contracts. Expected: fail.
- [ ] Implement idempotent MySQL DDL with InnoDB, utf8mb4, bigint keys, foreign keys, audit/event timestamps, and indexes.
- [ ] Implement dry-run importer first. Write mode uses a transaction, hashes every source password, imports only absent legacy IDs, and commits only if imported plus skipped equals source count.
- [ ] Before the first staging write, ask: Create new erp_ tables and import current employees into staging? Existing tables will not change.
- [ ] Run contracts and PHP syntax checks. Expected: pass.

### Task 4: Implement authentication, sessions, and personnel reads

Files:
- Create: public/api/src/Auth.php and public/api/src/Personnel.php
- Modify: public/api/index.php
- Test: tests/php/auth-test.php, tests/php/personnel-authorization-test.php, tests/php-auth-contract.test.mjs

Interface:
- Login verifies password hash and creates a random 32-byte token; only its SHA-256 hash is stored.
- Session cookie is Secure, HttpOnly, and SameSite=Lax.
- Personnel endpoints derive the actor from the session only.

- [ ] Write tests for successful login, generic 401, dismissed user denial, logout revocation, no password in me response, and 403 on missing personnel permission.
- [ ] Run tests. Expected: fail.
- [ ] Implement prepared-statement-only login, logout, me, departments, employee list, employee card, and platforms.
- [ ] Make all personnel reads filter status and require server-side personnel permission.
- [ ] Run syntax, PHP tests, and source contract. Expected: pass.

### Task 5: Wire personnel UI to stable IDs and cookie auth

Files:
- Modify: app/pages/personnel.vue, app/utils/erp-sheets.ts, app/middleware/erp-flow.global.ts
- Modify: store/erp-employee.store.ts, app/plugins/erp-init.client.ts, types/erp.types.ts
- Test: tests/personnel-sql-client-contract.test.mjs and tests/erp-session-stability-contract.test.mjs

- [ ] Write contracts prohibiting actorLogin, actorPassword, sheet row identity, and password responses in SQL-mode personnel calls.
- [ ] Run contracts. Expected: fail.
- [ ] Use stable SQL employee IDs for card/save/create/dismiss in SQL mode. Preserve GAS adapter for rollback.
- [ ] Add route loading state while session restores; retry transient API errors but clear profile only for 401.
- [ ] Make password reset a manager-only action with a value shown once, never returned by future card reads.
- [ ] Run contracts, typecheck, and lint. Expected: pass.

### Task 6: Package staging and apply the QA gate

Files:
- Modify: .github/workflows/nuxtjs.yml and docs/deployment.md
- Create: docs/sql-staging-qa.md
- Test: tests/sql-staging-deploy-contract.test.mjs

- [ ] Write workflow contract requiring npm run verify, environment-derived staging mode, API files in artifact, and no database credential in source.
- [ ] Configure staging backend mode as sql; production remains gas.
- [ ] Build with NUXT_PUBLIC_ERP_BACKEND_MODE=sql npm run generate and verify API files are present while private config is absent.
- [ ] Before each external mutation request confirmation for database import, private-config upload, and staging deployment.
- [ ] Run manager manual QA twice: login/reload/logout, denied personnel access, manager departments/card/update, executor counter scope, duplicate-write idempotency, and API retry.
- [ ] Keep production blocked until counts reconcile and every scenario passes twice.

### Task 7: Prepare operational migration as a separate wave

- [ ] After staging auth/personnel QA, write a separate spec and plan for badges, handover, warehouse, measurements, and packing.
- [ ] For each module document source action, SQL event, idempotency key, permission, rollback, and acceptance test.
- [ ] Migrate one module at a time. Production requires fresh backup, reconciliation, explicit confirmation, read-only login verification, and one verified operating shift before GAS rollback is removed.
