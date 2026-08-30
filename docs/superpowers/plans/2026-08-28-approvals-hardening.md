# Approvals v1 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure and finish the staging approvals experience with reliable actions, pending counts, and opt-in in-browser notifications.

**Architecture:** The Apps Script bridge remains the private Sheet adapter. The PHP API remains the authorization boundary and returns the actor-filtered queue plus a count. Vue state owns the one-minute refresh and notification session state; visual consumers read a shared summary rather than duplicating authorization logic.

**Tech Stack:** Nuxt/Vue 3, TypeScript, PHP 8, Google Apps Script, Node contract tests, Python staging smoke.

**Spec:** `docs/superpowers/specs/2026-08-28-approvals-hardening-design.md`

## Global Constraints

- Do not deploy to production or commit/push without separate user authorization.
- Never write credentials, tokens, or Sheet IDs into tracked source or command output.
- Keep the source Google Sheet schema unchanged.
- Use test-first red-green verification for each behavior change.
- Automated QA must be read-only against staging business rows.

---

### Task 1: Remove secret defaults and require private runtime configuration

**Files:**
- Modify: `gas/approvals-bridge/Code.gs`, `scripts/erp-approvals-bridge.gs`, `scripts/staging-approvals-auth-smoke.py`
- Modify: `tests/approvals-contract.test.mjs`

**Interfaces:**
- Consumes Script Properties `APPROVALS_SPREADSHEET_ID` and `APPROVALS_BRIDGE_TOKEN`.
- Produces a bridge that reports `approvals_source_unconfigured` or `forbidden` without seeding properties.

- [ ] **Step 1: Write failing source-contract tests**

Assert both bridge copies contain no `setProperty('APPROVALS_BRIDGE_TOKEN'` or literal staging sheet ID and that the smoke script has no password fallback.

- [ ] **Step 2: Run the focused test and verify red**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: failure naming the committed bridge default or smoke password fallback.

- [ ] **Step 3: Remove fallback seeding and require environment variables**

Delete `ensureApprovalsBridgeProperties_` and its calls. Change smoke setup to reject missing `ERP_QA_LOGIN` / `ERP_QA_PASSWORD` before issuing a request.

- [ ] **Step 4: Run focused tests and source scan**

Run: `node --test tests/approvals-contract.test.mjs && rg -n "APPROVALS_BRIDGE_TOKEN.*['\"]|QA_PASSWORD.*['\"]" gas scripts tests`

Expected: tests pass; scan contains only property/environment lookups, not secret values.

### Task 2: Make one gesture produce one UI surface

**Files:**
- Modify: `app/components/erp/ErpApprovalCard.vue`, `app/pages/approvals.vue`
- Modify: `tests/approvals-contract.test.mjs`

**Interfaces:**
- `request-decision` emits one action and never emits `open` for that interaction.
- A regular card tap emits `open` once.

- [ ] **Step 1: Add a failing regression contract**

Require action controls to stop `pointerdown` and `pointerup`, and require the card click handler to skip its trailing click after a completed horizontal swipe.

- [ ] **Step 2: Run the focused test and verify red**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: failure because button pointer events currently bubble to the card.

- [ ] **Step 3: Implement minimal event isolation**

Add a `suppressNextOpen` state to the card. Set it after a horizontal swipe, consume it in `onOpen`, and stop pointer propagation on both action buttons.

- [ ] **Step 4: Run focused test and build/type checks**

Run: `node --test tests/approvals-contract.test.mjs && npm run lint -- --no-fix`

Expected: contract passes and no new lint error is introduced.

### Task 3: Add the authoritative pending count to API and shared client state

**Files:**
- Modify: `public/api/src/Approvals.php`, `app/utils/erp-api.ts`, `app/utils/erp-sheets.ts`
- Create: `store/erp-approvals.store.ts`
- Modify: `tests/php/approvals-test.php`, `tests/approvals-contract.test.mjs`

**Interfaces:**
- `GET /approvals` returns `{rows: ErpApproval[], pendingCount: number}`.
- `useErpApprovalsStore()` exposes `pendingCount`, `load()`, and `refresh()` for the signed-in user.

- [ ] **Step 1: Add failing PHP and TypeScript contracts**

Assert `pendingCount === count(rows)` in an authorized bridge response and require the client type/store to expose a numeric count.

- [ ] **Step 2: Run tests and verify red**

Run: `php tests/php/approvals-test.php && node --test tests/approvals-contract.test.mjs`

Expected: failure because the current API has only `rows`.

- [ ] **Step 3: Implement count propagation**

Compute count only after the authorized bridge payload is validated; return it with rows. Update `fetchApprovalsViaApi` to return an object and use a small Pinia store to preserve last successful count across transient reload errors.

- [ ] **Step 4: Run tests and PHP syntax checks**

Run: `php tests/php/approvals-test.php && node --test tests/approvals-contract.test.mjs && php -l public/api/src/Approvals.php`

Expected: all pass.

### Task 4: Render count badges and opt-in browser notifications

**Files:**
- Modify: `app/pages/approvals.vue`, `app/pages/register.vue`, `app/components/erp/ErpTabBar.vue`
- Modify: `tests/approvals-contract.test.mjs`

**Interfaces:**
- Notifications are initiated only through an explicit `Включить уведомления` action.
- A mounted approvals page polls once per 60,000 ms and calls `new Notification` only for row numbers unseen in this browser session.

- [ ] **Step 1: Add failing UI contracts**

Assert the profile tile/tab bar consume the shared pending count and the page contains a permission action plus a 60-second interval guarded by `Notification.permission === 'granted'`.

- [ ] **Step 2: Run contract test and verify red**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: failure because no count rendering or notification workflow exists.

- [ ] **Step 3: Implement minimal UI and polling lifecycle**

Render a compact numeric badge only if `pendingCount > 0`. Track an initial `Set<number>` after first successful load, start/clear one interval with page mount/unmount, and catch notification API failures without changing queue state.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: all approvals contracts pass.

### Task 5: Rotate staging secrets and conduct controlled acceptance

**Files:**
- Modify only private staging Script Properties and private PHP config; no tracked source change.
- Run: `scripts/staging-approvals-auth-smoke.py`

**Interfaces:**
- Private config supplies matching bridge URL/token; Script Properties supplies matching token and source Sheet ID.

- [ ] **Step 1: Rotate credentials using non-echoing staging administration**

Create a new random bridge token and QA password, replace them in the relevant private stores, and revoke old values. Do not paste values into chat, terminal output, or repository files.

- [ ] **Step 2: Verify read-only boundaries**

Run: `ERP_QA_LOGIN=… ERP_QA_PASSWORD=… python3 scripts/staging-approvals-auth-smoke.py`

Expected: anonymous 401 and no-permission user 403 checks pass.

- [ ] **Step 3: Run controlled write acceptance with disposable rows**

Use one manager-visible disposable row for approval and a different one for rejection. Confirm expected date cells and audit entries exactly once; confirm repeat returns `already_processed`. This changes staging sheet data and requires the user’s action-time approval.

- [ ] **Step 4: Full verification**

Run: `node --test tests/*.test.mjs && php tests/php/approvals-test.php && php tests/php/approvals-authorization-test.php && python3 scripts/staging-approvals-auth-smoke.py`

Expected: all local and read-only staging checks pass.
