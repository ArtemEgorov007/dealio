# Согласования счетов v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить в staging безопасную очередь согласования счетов с ролевой фильтрацией, просмотром файлов и фиксируемыми действиями согласовать/отклонить.

**Architecture:** Клиент `/approvals` использует только same-origin PHP API. API проверяет серверную сессию и право `approvals`, затем вызывает token-protected Apps Script bridge; bridge читает или изменяет строго одну авторизованную строку листа «Согласование» и ведёт технический журнал. UI состоит из изолированных карточки, жестового контроллера и просмотрщика счёта.

**Tech Stack:** Nuxt 4/Vue 3/TypeScript, PHP 8, Google Apps Script, Node contract tests, PHP tests.

**Spec:** `docs/superpowers/specs/2026-08-28-invoice-approvals-design.md`

## Global Constraints

- Работать только в staging `erp-mt.online`; `erp-mt.ru` не изменять.
- Google Sheet — источник данных; клиенту не выдаются URL bridge, токен или доступ к таблице.
- Доступ требует активную серверную сессию и `approvals === true`.
- Сумма отображается как деньги в локали `ru-RU`; исходные поля строки не редактируются.
- Изменения Google Sheet выполняются только после повторной серверной проверки очереди и статуса строки.
- Все действия должны быть идемпотентны и иметь понятный результат на мобильном экране.
- Коммиты и push не выполнять без отдельного разрешения пользователя.

---

## File Structure

| Файл | Ответственность |
| --- | --- |
| `scripts/erp-approvals-bridge.gs` | Изолированный Google bridge: заголовки, очередь, единичное действие, аудит. |
| `public/api/src/Approvals.php` | Проверка сессии/права, запрос bridge, нормализация ответов. |
| `public/api/src/Bootstrap.php`, `Router.php`, `index.php` | Регистрация API `/approvals`. |
| `app/utils/erp-api.ts` | Типы и authenticated same-origin HTTP-клиент. |
| `app/utils/erp-sheets.ts` | Единая точка UI-транспорта согласований. |
| `app/components/erp/ErpApprovalCard.vue` | Карточка, swipe/tap, финальные состояния, альтернативные кнопки. |
| `app/components/erp/ErpInvoiceViewer.vue` | Модальное отображение PDF/ссылки с fallback. |
| `app/pages/approvals.vue` | Очередь, loading/error/empty, подтверждение действия. |
| `tests/approvals-contract.test.mjs`, `tests/php/approvals-test.php` | Контракт, фильтрация, доступ, идемпотентность, UI. |

### Task 1: Контракт и Apps Script bridge

**Files:**
- Create: `scripts/erp-approvals-bridge.gs`
- Create: `tests/approvals-contract.test.mjs`

**Interfaces:**
- Produces: `doGet(e)` с `action=queue`, `doPost(e)` с `action=decide`.
- Produces queue row `{rowNumber, stage, site, departmentType, invoice, amount, invoiceUrl}`.
- Produces action input `{action:'decide', decision:'approve'|'reject', rowNumber:number, actor:{fio:string,position:string}}`.

- [ ] **Step 1: Write the failing bridge contract test**

```js
assert.match(bridge, /APPROVALS_SPREADSHEET_ID/)
assert.match(bridge, /'Согласования'/)
assert.match(bridge, /'Отдел'/)
assert.match(bridge, /'Тип'/)
assert.match(bridge, /'Согласование руководителя'/)
assert.match(bridge, /'Ожидает РО'/)
assert.match(bridge, /'Ожидает ГД'/)
assert.match(bridge, /'Дата РО'/)
assert.match(bridge, /'Дата ГД'/)
assert.match(bridge, /'Отмена'/)
assert.match(bridge, /'Ссылка на счет'/)
```

- [ ] **Step 2: Run the contract test and confirm red**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: FAIL because the bridge file does not exist.

- [ ] **Step 3: Implement the minimal read-only queue bridge**

```js
function approvalQueue_(token, actor) {
  assertApprovalsToken_(token)
  const sheet = SpreadsheetApp.openById(APPROVALS_SPREADSHEET_ID).getSheetByName(APPROVALS_SHEET_NAME)
  const {header, rows} = approvalRows_(sheet)
  return rows.filter(row => approvalVisibleForActor_(row, header, actor)).map(row => approvalDto_(row, header))
}
```

Require every header listed in the spec, normalize names/position before comparison, and return no unneeded columns.

- [ ] **Step 4: Extend the test for action routing and idempotence**

```js
assert.match(bridge, /function approvalDecision_\(/)
assert.match(bridge, /action === 'approve'/)
assert.match(bridge, /'Дата РО'/)
assert.match(bridge, /'Дата ГД'/)
assert.match(bridge, /'Отмена'/)
assert.match(bridge, /already_processed/)
```

- [ ] **Step 5: Implement the minimal guarded action bridge**

```js
function approvalDecision_(token, actor, rowNumber, action) {
  assertApprovalsToken_(token)
  const row = readApprovalRow_(rowNumber)
  if (!approvalActorCanActOnRow_(row, header, actor)) throw new Error('not_available')
  const targetColumn = action === 'reject' ? 'Отмена' : (isDirector_(actor.position) ? 'Дата ГД' : 'Дата РО')
  const oppositeColumns = action === 'reject' ? ['Дата РО', 'Дата ГД'] : ['Отмена']
  if (cellText_(row[targetColumn])) return {status: 'already_processed'}
  if (oppositeColumns.some(name => cellText_(row[header[name]]))) throw new Error('approval_conflict')
  sheet.getRange(rowNumber, header.indexOf(targetColumn) + 1).setValue(new Date())
  appendApprovalAudit_(actor, rowNumber, action)
  return {status: action === 'reject' ? 'rejected' : 'approved'}
}
```

Reject an unknown action, nonpositive row number, actor-stage mismatch, or an opposite completed action. Skip malformed data rows and append an error audit; fail closed on a missing required header. Append successful action audit entries to an `ERP — журнал согласований` sheet in the same spreadsheet.

- [ ] **Step 6: Run the contract test and confirm green**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: PASS.

### Task 2: PHP API boundary

**Files:**
- Create: `public/api/src/Approvals.php`
- Modify: `public/api/src/Bootstrap.php`
- Modify: `public/api/src/Router.php`
- Modify: `public/api/index.php`
- Create: `tests/php/approvals-test.php`
- Modify: `tests/approvals-contract.test.mjs`

**Interfaces:**
- Consumes: private config `approvals.bridge_url`, `approvals.bridge_token`, `erp_require_user($pdo, $config, $requestId)`, and `erp_require_permission($pdo, $actor, 'approvals', $requestId)`.
- Produces: `erp_approvals_current(PDO $pdo, array $config, string $requestId): void` and `erp_approvals_decide(PDO $pdo, array $config, string $requestId): void`.

- [ ] **Step 1: Write the failing PHP adapter tests**

```php
assert_same('Генеральный директор', erp_approvals_position('  генеральный ДИРЕКТОР '));
assert_same('approved', erp_approvals_decision_status(['status' => 'approved']));
assert_throws(fn () => erp_approvals_action(['action' => 'delete']), 'invalid_action');
assert_throws(fn () => erp_approvals_payload(['ok' => false, 'error' => 'forbidden']), 'bridge_forbidden');
```

- [ ] **Step 2: Run the PHP test and confirm red**

Run: `php tests/php/approvals-test.php`

Expected: FAIL because `Approvals.php` is absent.

- [ ] **Step 3: Implement guarded PHP functions and API routes**

```php
function erp_approvals_current(PDO $pdo, array $config, string $requestId): void {
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'approvals', $requestId);
    return erp_approvals_bridge($config, 'queue', ['actor' => erp_approvals_actor($actor)]);
}

function erp_approvals_decide(PDO $pdo, array $config, string $requestId): void {
    $actor = erp_require_user($pdo, $config, $requestId);
    erp_require_permission($pdo, $actor, 'approvals', $requestId);
    return erp_approvals_bridge($config, 'decide', [
        'actor' => erp_approvals_actor($actor),
        'rowNumber' => erp_approvals_row_number($input),
        'action' => erp_approvals_action($input),
    ]);
}
```

Expose `GET /approvals` and `POST /approvals/decisions`. Keep bridge URL/token out of all error responses. Map unavailable bridge to HTTP 503; return a repeated identical action as HTTP 200 with `already_processed`, and a conflicting action or a row that has left the actor's queue as HTTP 409.

- [ ] **Step 4: Add API surface contracts**

```js
assert.match(router, /GET.*\/approvals/)
assert.match(router, /POST.*\/approvals\/decisions/)
assert.match(api, /credentials: 'include'/)
assert.match(api, /approvals/) 
```

- [ ] **Step 5: Run PHP and contract tests and confirm green**

Run: `php tests/php/approvals-test.php && node --test tests/approvals-contract.test.mjs`

Expected: PASS.

### Task 3: Typed client transport

**Files:**
- Modify: `app/utils/erp-api.ts`
- Modify: `app/utils/erp-sheets.ts`
- Modify: `tests/approvals-contract.test.mjs`

**Interfaces:**
- Consumes: `GET /api/approvals`, `POST /api/approvals/decisions`.
- Produces: `ErpApproval`, `ErpApprovalDecision`, `fetchApprovalsViaApi()`, `decideApprovalViaApi()` and public wrapper functions.

- [ ] **Step 1: Write the failing client contract test**

```js
assert.match(api, /export interface ErpApproval/)
assert.match(api, /fetchApprovalsViaApi/)
assert.match(api, /decideApprovalViaApi/)
assert.match(sheets, /fetchApprovals\(/)
assert.match(sheets, /decideApproval\(/)
```

- [ ] **Step 2: Run the client contract test and confirm red**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: FAIL because the client types and calls do not exist.

- [ ] **Step 3: Add typed same-origin client calls**

```ts
export interface ErpApproval {
  rowNumber: number
  stage: 'manager' | 'director'
  site: string
  departmentType: string
  invoice: string
  amount: number
  invoiceUrl: string
}

export async function decideApprovalViaApi(input: {rowNumber:number; action:'approve'|'reject'}): Promise<{status:'approved'|'rejected'|'already_processed'}> {
  return erpApiRequest('/approvals/decisions', {method: 'POST', body: JSON.stringify(input)})
}
```

`erp-sheets.ts` permits this transport only in SQL/staging backend mode and returns a visible staging-only error otherwise.

- [ ] **Step 4: Run the client contract test and confirm green**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: PASS.

### Task 4: Мобильные карточки и просмотр счёта

**Files:**
- Create: `app/components/erp/ErpApprovalCard.vue`
- Create: `app/components/erp/ErpInvoiceViewer.vue`
- Modify: `app/pages/approvals.vue`
- Modify: `tests/approvals-contract.test.mjs`

**Interfaces:**
- Consumes: `ErpApproval` and decision callback.
- Produces card emits `open`, `request-decision`, and accessible alternative action buttons.

- [ ] **Step 1: Write failing UI contracts**

```js
assert.match(card, /Площадка/)
assert.match(card, /Согласовать/)
assert.match(card, /Отклонить/)
assert.match(card, /pointerdown/)
assert.match(card, /pointerup/)
assert.match(viewer, /iframe/)
assert.match(viewer, /Открыть счёт/)
assert.match(page, /fetchApprovals/)
assert.match(page, /decideApproval/)
```

- [ ] **Step 2: Run UI contracts and confirm red**

Run: `node --test tests/approvals-contract.test.mjs`

Expected: FAIL because the approval components are absent.

- [ ] **Step 3: Implement the card and viewer**

```vue
<article class="erp-approval-card" @pointerdown="startSwipe" @pointerup="finishSwipe" @click="emit('open')">
  <p class="erp-approval-card__site">{{ approval.site }}</p>
  <p>{{ approval.departmentType }}</p>
  <strong>{{ approval.invoice }}</strong>
  <output>{{ money(approval.amount) }}</output>
</article>
```

Treat horizontal movement of at least 72px as a swipe only when it exceeds vertical movement; otherwise emit `open`. Render buttons for `Согласовать` and `Отклонить` below the card. Disable card controls during pending request and render final `approved`/`rejected` state.

Viewer uses a safe HTTPS-only URL check. It displays iframe only for a valid URL and a separate new-tab link for browsers that block the frame.

- [ ] **Step 4: Implement the queue page**

```ts
const reload = async () => { approvals.value = await fetchApprovals() }
const decide = async (approval, action) => {
  pendingRow.value = approval.rowNumber
  const result = await decideApproval({rowNumber: approval.rowNumber, action})
  states.value[approval.rowNumber] = result.status
  pendingRow.value = null
}
```

Provide loading, retry, empty queue, readable confirm dialog, and error states. Do not perform action until the confirmation is accepted.

- [ ] **Step 5: Run UI contracts, typecheck, and lint**

Run: `node --test tests/approvals-contract.test.mjs && npm run typecheck && npm run lint`

Expected: PASS.

### Task 5: Bridge deployment, private staging config, and QA

**Files:**
- Modify: `docs/sql-staging-qa.md`
- Modify: `.output/public/release.txt`

**Interfaces:**
- Consumes: tested bridge deployment URL/token stored only in Apps Script properties and `/www/erp-api-private/erp-api-config.php`.
- Produces: staging release marker and QA evidence.

- [ ] **Step 1: Deploy the Apps Script bridge with least public access**

Create a web-app deployment that runs as the authorised owner. Store `APPROVALS_BRIDGE_TOKEN` in Script Properties. Permit the endpoint only as technically necessary for the staging server; verify a tokenless request returns `forbidden` and a token-authenticated request returns only the filtered DTO fields.

- [ ] **Step 2: Configure staging private API only**

Add the `approvals` array to `/var/www/u3616626/data/www/erp-api-private/erp-api-config.php`. Set `bridge_url` to the web-app URL created in Step 1 and `bridge_token` to the `APPROVALS_BRIDGE_TOKEN` Script Property created in Step 1. Use a non-echoing server-side write so neither value appears in terminal output.

Do not write either value into Nuxt config, static files, source code, logs, Git, or production config.

- [ ] **Step 3: Build and run the complete local verification gate**

Run: `npm run verify && php tests/php/approvals-test.php && php tests/php/api-shell-test.php && npm run generate`

Expected: all tests pass; documented optional dependency/Rollup warnings may remain warnings only.

- [ ] **Step 4: Upload only staging output and validate release marker**

Upload `.output/public/.` to `www/erp-mt.online/` with no remote deletion. Verify `https://erp-mt.online/release.txt` contains the new release marker. Do not upload to `www/erp-mt.ru/`.

- [ ] **Step 5: Execute staging QA**

At mobile widths 390×844 and 393×852, verify: no-right user is rejected; RО queue is filtered by ФИО and `Ожидает РО`; ГД queue is filtered by `Ожидает ГД`; tap opens a valid invoice; each confirmed decision performs exactly one correct date write; tokenless bridge rejects; unavailable bridge displays retry. Record evidence and exclusions in `docs/sql-staging-qa.md`.
