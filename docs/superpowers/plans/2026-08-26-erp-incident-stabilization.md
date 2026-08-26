# ERP Incident Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore stable ERP sessions and the Personnel flow without modifying production business data.

**Architecture:** Canonical-origin and profile migration logic run before normal ERP initialization. Personnel navigation uses an explicit in-memory reset callback, while the static deployment receives a release-verification guard. SQL migration is intentionally excluded from this incident branch.

**Tech Stack:** Nuxt 3 SPA, Pinia, Vue, Node test runner, Google Apps Script, GitHub Actions, SFTP.

**Spec:** `docs/superpowers/specs/2026-08-26-erp-incident-stabilization-design.md`

## Global Constraints

- Production Sheets data and permissions are not changed by this branch.
- Each behavior change starts with a failing Node contract test.
- Deploy only after staging smoke checks and fresh full verification.

---

### Task 1: Preserve the employee session on a canonical origin

**Files:**
- Create: `app/plugins/00.erp-canonical-origin.client.ts`
- Modify: `store/erp-employee.store.ts`
- Create: `tests/erp-session-stability-contract.test.mjs`

- [ ] **Step 1: Write failing contracts**

Assert that the canonical-origin plugin redirects non-HTTPS/non-canonical hosts and that an existing valid stored profile is migrated rather than cleared when `erp-profile-version` differs.

- [ ] **Step 2: Run the contracts and verify failure**

Run: `node --test tests/erp-session-stability-contract.test.mjs`

- [ ] **Step 3: Implement the minimal session changes**

Redirect to `https://erp-mt.ru` while retaining path, query, and hash. In `loadProfile`, parse and validate the stored profile before writing the current version; only malformed or incomplete profiles call `clearProfile()`.

- [ ] **Step 4: Run the contracts and verify success**

Run: `node --test tests/erp-session-stability-contract.test.mjs`

- [ ] **Step 5: Commit**

Run: `git add app/plugins/00.erp-canonical-origin.client.ts store/erp-employee.store.ts tests/erp-session-stability-contract.test.mjs && git commit -m "fix(erp): preserve employee session on canonical origin"`

### Task 2: Repair the Personnel entry and navigation

**Files:**
- Modify: `app/pages/register.vue`
- Modify: `app/pages/personnel.vue`
- Modify: `app/components/erp/ErpScreen.vue`
- Modify: `app/components/erp/ErpPersonnelEmployeeTable.vue`
- Create: `tests/personnel-stability-contract.test.mjs`

- [ ] **Step 1: Write failing contracts**

Assert that the Personnel hub tile has no development caption, its tone is active, the back control invokes `returnToDepartments`, and employee rows include a visual open-card cue.

- [ ] **Step 2: Run the contracts and verify failure**

Run: `node --test tests/personnel-stability-contract.test.mjs`

- [ ] **Step 3: Implement the minimal UI changes**

Allow `ErpScreen.shiftLink` to render an action button. Pass `returnToDepartments` from Personnel, remove the Personnel development caption, and add a chevron/focus/hover affordance to employee rows.

- [ ] **Step 4: Run the contracts and verify success**

Run: `node --test tests/personnel-stability-contract.test.mjs`

- [ ] **Step 5: Commit**

Run: `git add app/pages/register.vue app/pages/personnel.vue app/components/erp/ErpScreen.vue app/components/erp/ErpPersonnelEmployeeTable.vue tests/personnel-stability-contract.test.mjs && git commit -m "fix(erp): stabilize personnel navigation"`

### Task 3: Lock the column-K rights contract and release checks

**Files:**
- Modify: `tests/erp-gas-personnel-contract.test.mjs`
- Modify: `.github/workflows/nuxtjs.yml`
- Create: `tests/ci-release-contract.test.mjs`

- [ ] **Step 1: Write failing contracts**

Assert the GAS schema starts rights from zero-based index 10 (column K), includes the `Доступ к биркам` header in the rights flow, and that the workflow publishes a release marker after output verification.

- [ ] **Step 2: Run the contracts and verify failure**

Run: `node --test tests/erp-gas-personnel-contract.test.mjs tests/ci-release-contract.test.mjs`

- [ ] **Step 3: Implement the minimum release guard**

Keep `header.slice(10)` explicit and add a non-secret release marker generated from the GitHub SHA into the static artifact. The deploy step uploads the marker with the same artifact.

- [ ] **Step 4: Run the contracts and verify success**

Run: `node --test tests/erp-gas-personnel-contract.test.mjs tests/ci-release-contract.test.mjs`

- [ ] **Step 5: Commit**

Run: `git add tests/erp-gas-personnel-contract.test.mjs .github/workflows/nuxtjs.yml tests/ci-release-contract.test.mjs && git commit -m "test(erp): guard personnel rights and releases"`

### Task 4: Verify and deploy safely

**Files:**
- Modify: `docs/deployment.md` if the actual hosting redirect setup adds a documented rule

- [ ] **Step 1: Run quality gates**

Run: `npm run lint && npm run typecheck && npm run generate && node --test tests/*.test.mjs`

- [ ] **Step 2: Test canonical endpoints read-only**

Run: `curl -sSIL https://erp-mt.ru/`, then inspect HTTP and `www` variants for a redirect after hosting setup.

- [ ] **Step 3: Staging deploy and browser smoke test**

Deploy the branch to staging, login with a synthetic staging employee, refresh, navigate Personnel, open and return from a department, and confirm the K-right field.

- [ ] **Step 4: Production deploy and smoke test**

Deploy only the verified artifact and repeat read-only navigation/session checks; do not create or modify production staff records.
