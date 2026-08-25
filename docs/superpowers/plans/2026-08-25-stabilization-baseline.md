# ERP Stabilization Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing ERP releasable and recoverable without changing the live production workflow or migrating operational data.

**Architecture:** Keep the current Nuxt static app and Google Apps Script adapters operational. Strengthen the delivery boundary first: automated quality gates, a deterministic smoke check, append-only audit records, and a documented backup/rollback process. Do not introduce a new database or session system in this phase; those require the separate product-foundation stage.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Node.js test runner, ESLint, GitHub Actions, Google Apps Script, Google Sheets, SFTP.

**Spec:** `docs/superpowers/specs/2026-08-25-product-readiness-design.md`

## Global Constraints

- Current production operations must keep using their existing spreadsheet schemas and GAS deployment URLs.
- Every behaviour change must pass local tests, staging deployment, and a mobile regression checklist before production.
- No passwords, SFTP credentials, spreadsheet contents, or employee data enter the repository, logs, tests, or audit sheet.
- Do not migrate the current plaintext authentication model in this stage; document the migration contract and do not add new features that expand its use.
- Every production deployment remains manually initiated after a successful staging check.
- Any change that writes business data must be idempotent and traceable with a request ID.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | One local verification command usable by a developer and CI. |
| `.github/workflows/nuxtjs.yml` | Enforce verification before artifact upload and run read-only deployment smoke checks. |
| `tests/ci-quality-gate-contract.test.mjs` | Prevent accidental removal of test/type/lint/build gates. |
| `tests/gas-audit-contract.test.mjs` | Prevent audit rows from storing credentials and ensure each mutating action produces an audit event. |
| `scripts/verify-gas-smoke.mjs` | Validate that a deployed GAS endpoint returns the expected JSON contract without writing data. |
| `scripts/erp-gas-webapp.js` | Append safe audit facts for every mutation in the primary ERP adapter. |
| `scripts/warehouse-gas-webapp.js` | Append safe audit facts for every warehouse mutation. |
| `app/utils/erp-sheets.ts` and `app/utils/warehouse-sheets.ts` | Attach a generated request ID to every mutation. |
| `docs/operations/backup-and-rollback.md` | Recovery procedure, owner actions and evidence for each release. |
| `docs/operations/auth-migration.md` | Fixed contract for the later identity migration; no password migration now. |
| `docs/operations/mobile-regression-checklist.md` | Manual acceptance steps for the existing operator flow. |

## Task 0: Isolate staging data before any mutation test

**Files:**
- Modify: `docs/deployment.md`
- Modify: `docs/operations/backup-and-rollback.md` (created in Task 5; add staging inventory section there)
- Test: `tests/ci-deploy-workflow.test.mjs`

**External resources:**
- Create one non-production copy of the operational spreadsheet and one non-production copy of the access spreadsheet, both inside an access-restricted Drive folder.
- Create separate staging deployments for the ERP and warehouse GAS projects. Their Script Properties must point only to the copied spreadsheet IDs.
- Set the `staging` GitHub Environment public URLs to the staging deployments. Production URLs and deployments must remain unchanged.

**Interfaces:**
- `erp-mt.online` communicates only with staging GAS and staging spreadsheet copies.
- `erp-mt.ru` continues communicating only with production GAS and production spreadsheets.
- A staging write cannot create or modify a row in the production spreadsheets.

- [ ] **Step 1: Record the current deployment mapping without exposing credentials**

Read existing GitHub Environment variable names, GAS deployment IDs and Script Property *names*. Record only labels, target type and version in `docs/deployment.md`; do not commit URLs, spreadsheet IDs, passwords or known-host values.

Required table shape:

```markdown
| Environment | Static host | ERP GAS target | Warehouse GAS target | Data target |
|---|---|---|---|---|
| staging | erp-mt.online | staging deployment | staging deployment | copied staging sheets |
| production | erp-mt.ru | production deployment | production deployment | production sheets |
```

- [ ] **Step 2: Create safe copies in Drive**

1. In the administrator Drive account, create a folder named `ERP — staging data — restricted`.
2. Copy the operational and access spreadsheets into that folder.
3. Remove every editor/viewer who does not require staging access.
4. Replace employee names, logins, passwords, QR values and operational history with synthetic records before testing writes.
5. Note only copy timestamps and owner role in the private release log; no IDs or data values go to Git.

- [ ] **Step 3: Create separate GAS staging deployments**

1. Clone the reviewed GAS source into new Apps Script projects; do not change the production deployment IDs.
2. Set `SPREADSHEET_ID` and `ACCESS_SPREADSHEET_ID` only in the staging project properties to the corresponding copied data sources.
3. Configure staging deployments using the minimum access that lets the static staging site run; production access settings remain unchanged.
4. Create a versioned deployment description containing `staging` and the Git commit short SHA.

- [ ] **Step 4: Point the staging environment at staging-only GAS**

Update only `staging` environment secrets `NUXT_PUBLIC_ERP_GAS_URL` and `NUXT_PUBLIC_WAREHOUSE_GAS_URL`. Do not alter the production environment or repository fallback secret. Run the existing workflow with `target=staging` and verify that the generated bundle contains the staging URL only through its configured runtime value; do not print the bundle value in CI output.

- [ ] **Step 5: Prove the separation safely**

1. Run the read-only smoke check against staging and production endpoints.
2. Run one deliberately pre-approved staging write using synthetic data.
3. Confirm only the staging sheet changed and production row counts/timestamps did not change.
4. Add the confirmation, tester role and timestamp to the private release log.

- [ ] **Step 6: Update the deployment contract test and commit**

Extend `tests/ci-deploy-workflow.test.mjs` to require both environment-specific URL secret names in the workflow, then run:

```bash
node --test tests/ci-deploy-workflow.test.mjs
git add docs/deployment.md tests/ci-deploy-workflow.test.mjs
git commit -m "docs(erp): isolate staging data and GAS deployments"
```

## Task 1: Make verification a mandatory delivery gate

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/nuxtjs.yml`
- Create: `tests/ci-quality-gate-contract.test.mjs`

**Interfaces:**
- Produces `npm run test:contract` and `npm run verify`.
- CI uses `npm run verify` before `actions/upload-artifact@v4`.
- CI invokes `node scripts/verify-gas-smoke.mjs "$NUXT_PUBLIC_ERP_GAS_URL"` after SFTP upload.

- [ ] **Step 1: Write the failing CI contract test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const workflow = readFileSync(new URL('../.github/workflows/nuxtjs.yml', import.meta.url), 'utf8')

test('release workflow runs the full verification gate before uploading the artifact', () => {
  assert.equal(packageJson.scripts['test:contract'], 'node --test tests/*.test.mjs')
  assert.equal(packageJson.scripts.verify, 'npm run lint && npm run typecheck && npm run test:contract && npm run generate')
  assert.match(workflow, /name: Verify ERP quality gate[\s\S]*run: npm run verify[\s\S]*name: Upload static artifact/)
})

test('deployment performs a read-only GAS smoke check after upload', () => {
  assert.match(workflow, /name: Smoke-check ERP GAS[\s\S]*node scripts\/verify-gas-smoke\.mjs/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/ci-quality-gate-contract.test.mjs`

Expected: FAIL because the scripts and workflow step do not exist.

- [ ] **Step 3: Add package scripts and workflow gate**

Add exactly these `scripts` entries to `package.json`:

```json
"test:contract": "node --test tests/*.test.mjs",
"verify": "npm run lint && npm run typecheck && npm run test:contract && npm run generate"
```

Insert this before `Upload static artifact` in the `build` job:

```yaml
      - name: Verify ERP quality gate
        run: npm run verify
```

Add this after `Upload static site without remote deletion` in the `deploy` job. Use the environment-scoped public URL already used during build; do not print it or any secret.

```yaml
      - name: Smoke-check ERP GAS
        env:
          NUXT_PUBLIC_ERP_GAS_URL: ${{ secrets.NUXT_PUBLIC_ERP_GAS_URL || secrets.NUXT_PUBLIC_CRM_GAS_URL }}
        run: node scripts/verify-gas-smoke.mjs "$NUXT_PUBLIC_ERP_GAS_URL"
```

- [ ] **Step 4: Run the contract test**

Run: `node --test tests/ci-quality-gate-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json .github/workflows/nuxtjs.yml tests/ci-quality-gate-contract.test.mjs
git commit -m "ci(erp): require quality gate before deploy"
```

## Task 2: Repair lint errors without changing ERP behaviour

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `app/components/kanban/CreateCard.vue`
- Modify: `app/components/kanban/slideover/useUpdateCard.ts`
- Modify: `app/components/kanban/useArchiveCard.ts`
- Modify: `app/components/layout/Loader.vue`
- Modify: `app/components/layout/Menu.vue`
- Modify: `app/components/ui/badge/Badge.vue`
- Modify: `app/components/ui/select/Select.vue`
- Modify: `app/pages/archive.vue`
- Modify: `app/pages/erp-setup.vue`
- Modify: `app/pages/login.vue`
- Modify: `app/pages/personnel.vue`
- Modify: `app/utils/appwrite-cards.ts`
- Modify: `store/auth-archive.store.ts`
- Modify: `store/board.store.ts`

**Interfaces:**
- Produces a zero-error `npm run lint` result.
- Keeps Nuxt fragment templates valid by disabling only `vue/no-multiple-template-root`, which is inapplicable to Vue 3/Nuxt 4.

- [ ] **Step 1: Capture the existing failure list**

Run: `npm run lint`

Expected: non-zero exit with the current errors; record only filenames/counts in the PR description, never customer data.

- [ ] **Step 2: Make the Vue 3 configuration explicit**

Add this to the Nuxt rules object in `eslint.config.mjs`:

```js
rules: {
  'vue/no-multiple-template-root': 'off',
},
```

This is a configuration correction, not a suppression of application errors: Vue 3 allows fragment roots.

- [ ] **Step 3: Apply the mechanical source corrections**

Perform only these semantics-preserving edits:

```ts
// import duplicates: combine type and value imports into one import declaration
import {useAuthStore, type AuthStore} from '~~/store/auth.store'

// caught errors: retain the original exception as a cause
catch (error) {
  throw new Error('Не удалось сохранить изменения', {cause: error})
}

// unused setup bindings: remove `const props = defineProps(...)` when no
// script expression uses it; keep `defineProps(...)` as a compiler macro.
defineProps<{ label?: string }>()

// type-only imports
import type {IBoardCard} from '~~/types/cards.types'
```

For `app/pages/personnel.vue`, remove the unused `returnToDepartments` and `selectedEmployeeRow` declarations rather than retaining dead navigation state. For `app/utils/appwrite-cards.ts`, remove the assignment whose value is overwritten before it is read. For `app/components/ui/select/Select.vue`, combine the two emits overloads into one union-signature overload.

- [ ] **Step 4: Apply only safe ESLint autofixes and inspect the diff**

Run: `npx eslint . --fix`

Then run: `git diff --check && git diff -- app store`

Expected: formatting/attribute-order changes only; revert any behavioural change before continuing.

- [ ] **Step 5: Verify quality and ERP contracts**

Run:

```bash
npm run lint
npm run typecheck
npm run test:contract
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs app store
git commit -m "chore(erp): make lint a releasable quality gate"
```

## Task 3: Add a read-only deployment smoke checker

**Files:**
- Create: `scripts/verify-gas-smoke.mjs`
- Create: `tests/gas-smoke-script.test.mjs`

**Interfaces:**
- `node scripts/verify-gas-smoke.mjs <gas-url>` exits 0 only for a reachable endpoint that returns JSON `{ok:false,error:"Unknown action"}` for a harmless GET request.
- The command never sends a POST, credentials, spreadsheet IDs, or employee names.

- [ ] **Step 1: Write the failing source contract test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

const source = readFileSync(new URL('../scripts/verify-gas-smoke.mjs', import.meta.url), 'utf8')

test('GAS smoke check uses only a harmless unknown GET action', () => {
  assert.match(source, /new URL\(gasUrl\)/)
  assert.match(source, /searchParams\.set\('action', 'healthcheck'\)/)
  assert.doesNotMatch(source, /method:\s*['"]POST['"]/)
  assert.match(source, /payload\.ok !== false \|\| payload\.error !== 'Unknown action'/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/gas-smoke-script.test.mjs`

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement the checker**

```js
const gasUrl = process.argv[2]
if (!gasUrl) throw new Error('GAS URL is required')

const url = new URL(gasUrl)
url.searchParams.set('action', 'healthcheck')

const response = await fetch(url, {signal: AbortSignal.timeout(20_000)})
if (!response.ok) throw new Error(`GAS smoke request failed with HTTP ${response.status}`)

const payload = await response.json()
if (payload.ok !== false || payload.error !== 'Unknown action') {
  throw new Error('GAS smoke response does not match the public contract')
}
```

Do not log `url.href`; CI logs must not expose endpoint identifiers unnecessarily.

- [ ] **Step 4: Verify script and existing contract suite**

Run:

```bash
node --test tests/gas-smoke-script.test.mjs
node scripts/verify-gas-smoke.mjs 'https://example.invalid'
```

Expected: first command PASS; second command fails safely before any business write.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-gas-smoke.mjs tests/gas-smoke-script.test.mjs
git commit -m "test(erp): add read-only GAS deployment smoke check"
```

## Task 4: Add safe audit events to both Google Apps Script adapters

**Files:**
- Modify: `scripts/erp-gas-webapp.js`
- Modify: `scripts/warehouse-gas-webapp.js`
- Modify: `app/utils/erp-sheets.ts`
- Modify: `app/utils/warehouse-sheets.ts`
- Create: `tests/gas-audit-contract.test.mjs`

**Interfaces:**
- Each mutating POST includes `requestId: string` generated by the existing `useIdempotencyKey` pattern or a new pure `createRequestId()` utility.
- `appendAudit_(event)` creates/uses a sheet named `Аудит ERP` and appends `[timestamp, adapter, action, actor, target, requestId, result]`.
- `event` must never contain password, actorPassword, login secret, raw QR payload, or full employee record.

- [ ] **Step 1: Write the failing audit contract test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

for (const file of ['scripts/erp-gas-webapp.js', 'scripts/warehouse-gas-webapp.js']) {
  const source = readFileSync(file, 'utf8')
  test(`${file} has an append-only safe audit helper`, () => {
    assert.match(source, /const AUDIT_SHEET = 'Аудит ERP'/)
    assert.match(source, /function appendAudit_\(event\)/)
    assert.match(source, /appendRow\(\[new Date\(\), event\.adapter, event\.action, event\.actor, event\.target, event\.requestId, event\.result\]\)/)
    assert.doesNotMatch(source, /appendAudit_\([\s\S]{0,300}password/)
  })
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/gas-audit-contract.test.mjs`

Expected: FAIL because neither adapter has audit support.

- [ ] **Step 3: Add the isolated audit helper to each adapter**

Use the same helper in both scripts:

```js
const AUDIT_SHEET = 'Аудит ERP'

function appendAudit_(event) {
  const spreadsheet = getSpreadsheet_()
  let sheet = spreadsheet.getSheetByName(AUDIT_SHEET)
  if (!sheet) {
    sheet = spreadsheet.insertSheet(AUDIT_SHEET)
    sheet.appendRow(['Время', 'Адаптер', 'Действие', 'Исполнитель', 'Объект', 'Request ID', 'Результат'])
  }
  sheet.appendRow([new Date(), event.adapter, event.action, event.actor, event.target, event.requestId, event.result])
}
```

Call it only after a successful business mutation, while the existing operation lock is still held. Examples:

```js
appendAudit_({
  adapter: 'erp-gas',
  action: 'issueBadge',
  actor: normalizeCell_(fio),
  target: normalizeCell_(badgeContent),
  requestId: normalizeCell_(requestId),
  result: 'ok',
})
```

For personnel actions, use the acting manager FIO and a target of `Сотрудники!<row>`; do not log password changes or their values. For QR packing, use the generated warehouse item ID rather than raw QR text.

- [ ] **Step 4: Propagate request IDs from the client**

In each mutation wrapper add the existing request identifier to the POST body:

```ts
requestId: createRequestId(),
```

Use one ID per user submission and reuse it for an explicit retry of that same submission. Do not generate IDs in read methods.

- [ ] **Step 5: Verify source contracts and syntax**

Run:

```bash
node --test tests/gas-audit-contract.test.mjs tests/*.test.mjs
node --check scripts/erp-gas-webapp.js
node --check scripts/warehouse-gas-webapp.js
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Deploy only to staging and inspect the audit sheet**

1. Push the GAS code to the staging script project.
2. Create a new staging deployment version; do not edit the production deployment.
3. Execute one pre-approved non-destructive staging operation.
4. Verify exactly one new row in `Аудит ERP`; verify it contains no password or raw QR value.
5. Record the version and result in the release evidence section of `docs/operations/backup-and-rollback.md`.

- [ ] **Step 7: Commit**

```bash
git add scripts app/utils tests/gas-audit-contract.test.mjs
git commit -m "feat(erp): audit operational mutations safely"
```

## Task 5: Write and rehearse backup, rollback and mobile acceptance operations

**Files:**
- Create: `docs/operations/backup-and-rollback.md`
- Create: `docs/operations/mobile-regression-checklist.md`
- Create: `docs/operations/auth-migration.md`
- Create: `tests/operations-runbook-contract.test.mjs`

**Interfaces:**
- The backup runbook names the owner role, evidence, cadence, restore target and escalation condition.
- The mobile checklist covers operator flows without requiring production data edits.
- The auth migration document fixes the future session contract and explicitly prohibits plaintext-password copying.

- [ ] **Step 1: Write the failing documentation contract**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

const backup = readFileSync('docs/operations/backup-and-rollback.md', 'utf8')
const mobile = readFileSync('docs/operations/mobile-regression-checklist.md', 'utf8')
const auth = readFileSync('docs/operations/auth-migration.md', 'utf8')

test('operations documents define recovery, release and data-safety controls', () => {
  assert.match(backup, /RPO: 24 часа/)
  assert.match(backup, /RTO: 4 часа/)
  assert.match(backup, /Откат production/)
  assert.match(mobile, /Android/)
  assert.match(mobile, /iOS/)
  assert.match(auth, /HttpOnly/)
  assert.match(auth, /Пароль никогда не переносится в plaintext/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/operations-runbook-contract.test.mjs`

Expected: FAIL because the documents do not exist.

- [ ] **Step 3: Write the backup and rollback runbook**

`docs/operations/backup-and-rollback.md` must include these fixed sections:

```markdown
## Backup cadence
- Owner: ERP administrator.
- Daily: export both operational spreadsheets and the access spreadsheet to an access-restricted Drive backup folder.
- Before every production deployment: save the current GAS deployment version IDs and GitHub Actions URL.
- Evidence: timestamp, exporter, Drive file IDs, GAS versions and release URL in the release log.

## Restore test
- Monthly: restore one backup into a new staging spreadsheet, configure only the staging Script Properties, and run the read-only smoke check.
- Success: staging opens and the copied data matches the backup row counts.
- RPO: 24 часа. RTO: 4 часа.

## Откат production
1. Stop at the first confirmed regression; do not patch production directly.
2. Re-deploy the preceding immutable GAS version ID.
3. Dispatch the preceding Git commit to the production workflow.
4. Run the read-only smoke check and the affected mobile checklist section.
5. Add incident time, owner, impact and resolution to the release log.
```

- [ ] **Step 4: Write the mobile regression checklist**

Include one pass/fail row each for Android Chrome and iOS Safari, with these flows: login, visible role-based tiles, badge issue confirmation/retry, warehouse receive/issue retry, QR scan permission/error, handover confirmation, personnel access denial, offline error recovery, logout and fresh login. Require staging data or a demo tenant; never use an arbitrary real employee record for destructive testing.

- [ ] **Step 5: Write the auth migration contract**

Include this non-negotiable target contract:

```markdown
- Password is accepted only by the identity endpoint over TLS, verified against a salted slow hash, then discarded.
- Browser stores no password and sends no password after login.
- Session is a short-lived opaque token in a Secure, HttpOnly, SameSite cookie; refresh and logout are server-side revocations.
- API responses and audit events never include a password or hash.
- Пароль никогда не переносится в plaintext между Google Sheets, API, браузером, логами или резервными копиями.
```

- [ ] **Step 6: Verify documentation and contract suite**

Run: `node --test tests/operations-runbook-contract.test.mjs tests/*.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/operations tests/operations-runbook-contract.test.mjs
git commit -m "docs(erp): add recovery and release operations"
```

## Task 6: Stage, review, and release the stabilization baseline

**Files:**
- Modify: `docs/operations/backup-and-rollback.md` (release evidence section only)

**Interfaces:**
- Staging deployment must use the same commit under review.
- Production deployment requires a completed staging checklist and an explicit release decision.

- [ ] **Step 1: Run the complete local gate**

Run:

```bash
npm run verify
git diff --check
git status --short
```

Expected: all verification commands exit 0 and the only remaining changes are those intended for the release.

- [ ] **Step 2: Review the pull request before merge**

Check: no credentials in diff, no spreadsheet IDs newly added, no production URL or customer record in tests, no destructive sheet operation, and all new write actions include idempotency/audit coverage.

- [ ] **Step 3: Deploy to staging and execute acceptance**

1. Push the branch and open a pull request.
2. Merge only after CI is green.
3. Let the `main` push deploy staging.
4. Run the smoke check, then the Android/iOS checklist against staging/demo data.
5. Fill the release evidence table with commit, workflow URL, GAS version, backup timestamp and tester.

- [ ] **Step 4: Release to production**

1. Confirm staging evidence is complete and the current production backup exists.
2. Dispatch the production workflow for the merged commit.
3. Update GAS production only with the same reviewed source version.
4. Run the read-only smoke check and the affected mobile checklist section.
5. If any check fails, execute `Откат production` from the runbook rather than hot-fixing the live files.

- [ ] **Step 5: Commit release evidence**

```bash
git add docs/operations/backup-and-rollback.md
git commit -m "docs(erp): record stabilization release evidence"
```

## Plan Self-Review

- Spec coverage: CI quality gate (Task 1–2), staging smoke check (Task 1 and 3), audit and idempotency traceability (Task 4), backup/RPO/RTO/rollback (Task 5), security migration boundary (Task 5), and staging-to-production release discipline (Task 6) are all covered. The director dashboard, demo tenant and multi-tenant database are intentionally excluded; they are later phases in the approved specification.
- Placeholder scan: no unresolved placeholders or undefined handoffs remain; manual actions identify their actor and expected evidence.
- Type consistency: `requestId`, `appendAudit_(event)`, `npm run test:contract`, and `npm run verify` have one spelling and contract throughout the plan.
