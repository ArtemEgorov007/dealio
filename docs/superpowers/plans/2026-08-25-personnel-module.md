# Personnel Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ERP personnel placeholder with a secure department directory and employee-management interface backed by the existing GAS application.

**Architecture:** The GAS application remains the single gateway to the private `Сотрудники` and `Площадки` sheets. Each personnel request is a POST containing the current actor credentials; GAS validates `Управление кадрами = Да`, derives sheet columns from headers, and returns typed JSON. The Nuxt page owns the departments → employee list → employee card flow and delegates network access to `erp-sheets.ts`.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, Pinia, TypeScript, Google Apps Script, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-personnel-module-design.md`

## Global Constraints

- Use the existing ERP Web App and the `Сотрудники` sheet in the access spreadsheet; do not introduce a second API or expose the sheet directly to browsers.
- Require the actor’s valid login, password, active status and `Управление кадрами = Да` for every personnel action.
- Treat header names as the source of truth; rights are exactly the columns at index K and later.
- Never allow card-save to modify `ФИО`, `Отдел` or `Должность`.
- New employee status is exactly `Работает`; dismissal status is exactly `Уволен`.
- Generate the new employee password on GAS: exactly 10 Latin letters/digits including at least one lowercase letter, uppercase letter and digit.
- Keep the production GAS URL and deployment access unchanged; production rollout requires separate user confirmation after staging verification.

---

### Task 1: Define and test the personnel GAS contract

**Files:**
- Create: `tests/erp-gas-personnel-contract.test.mjs`
- Create: `tests/personnel-password.test.mjs`
- Create: `scripts/personnel-password.js`
- Modify: `scripts/erp-gas-webapp.js: doPost and staff helpers`

**Interfaces:**
- Produces `personnelDepartments_()`, `personnelEmployees_(department)`, `personnelEmployee_(row, fio)`, `savePersonnelEmployee_(payload)`, `createPersonnelEmployee_(payload)`, `dismissPersonnelEmployee_(row, fio)` and `generatePersonnelPassword_()` in GAS.
- Produces POST actions `personnelDepartments`, `personnelEmployees`, `personnelEmployee`, `personnelSave`, `personnelCreate`, `personnelDismiss`.

- [ ] **Step 1: Write failing static contract tests**

Create `tests/erp-gas-personnel-contract.test.mjs` with assertions that the GAS source exposes all six POST actions, checks `Управление кадрами`, reads `Площадки`, starts rights at index `10`, writes `Уволен`, and uses `LockService.getScriptLock()` for mutations:

```js
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')

test('personnel endpoints enforce staff-management access and dynamic rights', () => {
  for (const action of ['personnelDepartments', 'personnelEmployees', 'personnelEmployee', 'personnelSave', 'personnelCreate', 'personnelDismiss']) {
    assert.match(source, new RegExp(`payload\\.action === '${action}'`))
  }
  assert.match(source, /header\.indexOf\('Управление кадрами'\)/)
  assert.match(source, /getSheetByName\('Площадки'\)/)
  assert.match(source, /slice\(10\)/)
  assert.match(source, /'Уволен'/)
  assert.match(source, /LockService\.getScriptLock\(\)/)
})
```

Create `tests/personnel-password.test.mjs` that evaluates the GAS-safe helper source and asserts one hundred generated values have length 10 and match `[a-z]`, `[A-Z]`, `[0-9]`, and `^[A-Za-z0-9]+$`:

```js
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../scripts/personnel-password.js', import.meta.url), 'utf8')
const {generatePersonnelPassword_, isPersonnelPassword_} = new Function(`${source}; return {generatePersonnelPassword_, isPersonnelPassword_}`)()

test('generated personnel password has the required ten-character composition', () => {
  for (let index = 0; index < 100; index += 1) {
    const value = generatePersonnelPassword_()
    assert.equal(value.length, 10)
    assert.equal(isPersonnelPassword_(value), true)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/erp-gas-personnel-contract.test.mjs tests/personnel-password.test.mjs`

Expected: FAIL because personnel actions and the password helper do not exist.

- [ ] **Step 3: Implement the GAS authorization and data helpers**

Add a single `requirePersonnelActor_(login, password)` helper that calls the same credentials/status rules as `login_` and rejects unless `Управление кадрами` is `Да`. Add `getStaffSheet_()` and `getStaffSchema_()` that require base headers and return a map with `rightsHeaders: header.slice(10)`.

Use this response shape for an employee:

```js
{
  row: 7,
  fio: 'Иванов Иван Иванович',
  department: 'Производство',
  position: 'Оператор',
  platform: 'Офис',
  role: 'Исполнитель',
  login: 'ivanov',
  password: 'Ab1xYz9Qwe',
  status: 'Работает',
  rights: [{name: 'Доступ к биркам', value: 'Да'}]
}
```

Return departments as `{ department, activeCount }[]`, filtering blank departments and counting only status `Работает`. Return employees as `{ row, fio, position }[]` for the requested department. Return platform labels from non-empty values in the `Площадки` sheet, de-duplicated in sheet order.

For every save/create/dismiss mutation, acquire a script lock, re-read the row, validate the row’s FIO, then write only permitted cells. Reject a login equal to another row’s normalized login. Create `scripts/personnel-password.js` as a GAS-safe global helper with `generatePersonnelPassword_()` and `isPersonnelPassword_()`. The generator uses fixed lowercase, uppercase and digit seed characters followed by shuffled characters from `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`.

- [ ] **Step 4: Implement the pure password helper and run tests**

Create `app/utils/personnel-password.ts` for browser-side validation:

```ts
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'

export function isPersonnelPassword(value: string): boolean {
  return value.length === 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /^[A-Za-z0-9]+$/.test(value)
}
```

Use the browser helper to validate a manually edited password. Run:

`node --test tests/erp-gas-personnel-contract.test.mjs tests/personnel-password.test.mjs && node --check scripts/erp-gas-webapp.js`

Expected: all tests pass and GAS syntax is valid.

- [ ] **Step 5: Commit the contract**

```bash
git add scripts/erp-gas-webapp.js scripts/personnel-password.js app/utils/personnel-password.ts tests/erp-gas-personnel-contract.test.mjs tests/personnel-password.test.mjs
git commit -m "feat(erp): add protected personnel GAS actions"
```

### Task 2: Add typed personnel client APIs

**Files:**
- Modify: `types/erp.types.ts`
- Modify: `app/utils/erp-sheets.ts`
- Test: `tests/erp-personnel-client-contract.test.mjs`

**Interfaces:**
- Consumes Task 1 response shapes and the persisted `ErpEmployeeProfile.login/password` of the current actor.
- Produces `fetchPersonnelDepartments`, `fetchPersonnelEmployees`, `fetchPersonnelEmployee`, `savePersonnelEmployee`, `createPersonnelEmployee`, and `dismissPersonnelEmployee`.

- [ ] **Step 1: Write the failing client contract test**

Create `tests/erp-personnel-client-contract.test.mjs` that reads `erp-sheets.ts` and asserts each exported client function routes through `requestGasPost`, never `requestGas`, and includes `actorLogin` and `actorPassword` in its payload.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/erp-personnel-client-contract.test.mjs`

Expected: FAIL because the personnel client functions do not exist.

- [ ] **Step 3: Define types and implement the requests**

Add these types to `types/erp.types.ts`:

```ts
export interface ErpPersonnelDepartment { department: string; activeCount: number }
export interface ErpPersonnelRow { row: number; fio: string; position: string }
export interface ErpPersonnelRight { name: string; value: 'Да' | 'Нет' }
export interface ErpPersonnelEmployee extends ErpPersonnelRow {
  department: string; platform: string; role: 'Исполнитель' | 'Менеджер'; login: string; password: string; status: string; rights: ErpPersonnelRight[]
}
export interface ErpPersonnelDraft { fio: string; department: string; position: string; platform: string; role: 'Исполнитель' | 'Менеджер'; login: string; password?: string; rights: ErpPersonnelRight[] }
```

In `erp-sheets.ts`, introduce `PersonnelActor = Pick<ErpLoginProfile, 'login' | 'password'>` and build each payload as `{ action, actorLogin: actor.login, actorPassword: actor.password, ... }`. Convert non-OK responses to the existing user-facing error style. Reject calls when actor login/password are absent.

- [ ] **Step 4: Run contract and type checks**

Run: `node --test tests/erp-personnel-client-contract.test.mjs tests/erp-gas-personnel-contract.test.mjs tests/personnel-password.test.mjs && npm run typecheck`

Expected: all tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit the client layer**

```bash
git add types/erp.types.ts app/utils/erp-sheets.ts tests/erp-personnel-client-contract.test.mjs
git commit -m "feat(erp): add typed personnel client"
```

### Task 3: Build the departments and employee-list screens

**Files:**
- Create: `app/components/erp/ErpPersonnelDepartmentTile.vue`
- Create: `app/components/erp/ErpPersonnelEmployeeTable.vue`
- Modify: `app/pages/personnel.vue`
- Test: `tests/personnel-page-contract.test.mjs`

**Interfaces:**
- Consumes the Task 2 client functions and `useErpEmployeeStore()` as the actor source.
- Produces department selection and employee-row selection events for the card sheet in Task 4.

- [ ] **Step 1: Write the failing page contract test**

Create `tests/personnel-page-contract.test.mjs` that verifies `personnel.vue` calls `fetchPersonnelDepartments`, renders `ErpPersonnelDepartmentTile`, includes an add employee control, calls `fetchPersonnelEmployees`, and uses an employee table with `Должность` and `ФИО` headers.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/personnel-page-contract.test.mjs`

Expected: FAIL because the page is still a placeholder.

- [ ] **Step 3: Implement loading, error and navigation states**

`ErpPersonnelDepartmentTile.vue` accepts `{ department: string; activeCount: number; add?: boolean }` and renders a large accessible button. The ordinary tile displays the department and `${activeCount} сотрудников работают`; the `add` tile uses `heroicons:plus` and label `Добавить сотрудника`.

`ErpPersonnelEmployeeTable.vue` accepts `employees: ErpPersonnelRow[]` and emits `select(row)`. Render a two-column card table with exactly `Должность` and `ФИО`; each body row is a button with an accessible label containing the employee FIO.

Replace the placeholder page with states `departments`, `employees`, `loading`, and `error`. On mount load departments and platforms using the authenticated actor. Selecting a department loads its rows; the header shift link goes back to departments. Use `ErpEmptyState` for loading, retryable network errors and no active departments/employees.

- [ ] **Step 4: Run the page contract and type checks**

Run: `node --test tests/personnel-page-contract.test.mjs && npm run typecheck`

Expected: PASS with no type errors.

- [ ] **Step 5: Commit the directory UI**

```bash
git add app/pages/personnel.vue app/components/erp/ErpPersonnelDepartmentTile.vue app/components/erp/ErpPersonnelEmployeeTable.vue tests/personnel-page-contract.test.mjs
git commit -m "feat(erp): show personnel departments and employees"
```

### Task 4: Add employee card, creation and dismissal flows

**Files:**
- Create: `app/components/erp/ErpPersonnelForm.vue`
- Modify: `app/pages/personnel.vue`
- Test: `tests/personnel-form-contract.test.mjs`

**Interfaces:**
- Consumes Task 2 typed actions and Task 3 selected department/employee state.
- Produces create, update and dismiss operations that refresh the current page state only after the server returns success.

- [ ] **Step 1: Write the failing form contract test**

Create `tests/personnel-form-contract.test.mjs` to assert the form contains read-only `ФИО`, `Отдел`, `Должность`; editable `Площадка`, `Роль`, `Логин`, `Пароль`; a `Да`/`Нет` rights control; and a `Уволить` action. Assert `personnel.vue` calls `savePersonnelEmployee`, `createPersonnelEmployee`, and `dismissPersonnelEmployee`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/personnel-form-contract.test.mjs`

Expected: FAIL because no personnel form exists.

- [ ] **Step 3: Implement the reusable form and action sheets**

Create `ErpPersonnelForm.vue` with props `{ employee?: ErpPersonnelEmployee; platforms: string[]; busy: boolean; create: boolean }` and events `{ submit: [ErpPersonnelDraft]; dismiss: []; cancel: [] }`.

For existing employees, show immutable values as text and editable values as controls. For new employees, show inputs for FIO, department, position, role, platform and login; do not show password input because the server supplies it. Render each right as a labelled row with a two-option `Да`/`Нет` segmented control. Require all create fields, validate manual password with `isPersonnelPassword`, and disable submit while busy.

In `personnel.vue`, open `ErpActionSheet` for add and employee card. On successful save/create, replace the cached employee with the returned one, reload the selected department and departments count, and show `useAppToast()` success feedback. On dismissal, show a separate confirmation sheet; only its confirm button calls `dismissPersonnelEmployee`, then closes the card and reloads the department list.

- [ ] **Step 4: Run form, page and type checks**

Run: `node --test tests/personnel-form-contract.test.mjs tests/personnel-page-contract.test.mjs tests/erp-personnel-client-contract.test.mjs tests/erp-gas-personnel-contract.test.mjs tests/personnel-password.test.mjs && npm run typecheck`

Expected: all tests pass and typecheck succeeds.

- [ ] **Step 5: Commit personnel operations**

```bash
git add app/pages/personnel.vue app/components/erp/ErpPersonnelForm.vue tests/personnel-form-contract.test.mjs
git commit -m "feat(erp): manage personnel records"
```

### Task 5: Verify, document and prepare staging rollout

**Files:**
- Modify: `README.md` only if its ERP deployment section must name the new tested GAS actions.
- Modify: `scripts/erp-gas-webapp.js` only if verification exposes a defect in Tasks 1–4.

**Interfaces:**
- Consumes the complete UI and GAS contract from Tasks 1–4.
- Produces a tested branch ready for review and staging deployment.

- [ ] **Step 1: Run all focused tests and source syntax checks**

Run:

```bash
node --test tests/erp-gas-personnel-contract.test.mjs tests/personnel-password.test.mjs tests/erp-personnel-client-contract.test.mjs tests/personnel-page-contract.test.mjs tests/personnel-form-contract.test.mjs
node --check scripts/erp-gas-webapp.js
```

Expected: all focused tests pass and GAS source has valid syntax.

- [ ] **Step 2: Run complete frontend verification**

Run:

```bash
npm run typecheck
npm run generate
git diff --check
```

Expected: successful static generation and no whitespace errors.

- [ ] **Step 3: Review changed contract boundaries**

Verify manually from source that every `personnel*` request passes actor credentials only in POST bodies; no GET endpoint returns staff information; write endpoints all invoke the staff-management authorization helper; and create never accepts a client-provided password.

- [ ] **Step 4: Commit verification-only documentation if changed**

If `README.md` changed, run:

```bash
git add README.md
git commit -m "docs(erp): document personnel actions"
```

If no documentation change is needed, do not create an empty commit.

- [ ] **Step 5: Request review and staging authorization**

Open a PR from `codex/personnel`, report the exact test output, and request approval to push the GAS code, create a new GAS version, and deploy the static site to staging. Do not update the production GAS deployment or production site until the user gives a separate explicit confirmation.
