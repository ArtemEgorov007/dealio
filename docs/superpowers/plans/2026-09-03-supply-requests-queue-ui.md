# Supply Requests Queue UI Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the supply «Заявки» queue card and status tabs so cards show contents + date, hide amounts/invoices/platform, and rejected invoices land in tab «Отменен».

**Architecture:** Read-only queue API (`erp_supply_work_requests_queue`) gains line-items via a second query (same pattern as `erp_supply_my_requests`) and maps `Отклонен` → bucket `cancelled`. Client types and `supply-requests-queue.vue` follow. Employee `/supply-requests` is out of scope.

**Tech Stack:** Nuxt 4 SPA, PHP API, MySQL, Node contract tests (`node --test`).

**Spec:** User TZ «Заявки: корректировки интерфейса» + advisor ruling 2026-09-03 (rejected → tab «Отменен»).

## Global Constraints

- Staging only: `erp-mt.online`. Never touch `erp-mt.ru`.
- Do not commit/push unless user asks.
- Keep `ERP_SUPPLY_STATUS_NEW = 'Ожидает счёт'` (no DB migration for TZ prose «Ожидает счет»).
- Keep `ERP_INVOICE_STATUS_REJECTED = 'Отклонен'`; tab label is «Отменен».
- Do not edit `app/pages/supply-requests.vue`.
- Keep `department` and `employeeFio` on the card; remove only `platform` display.
- No unrelated refactors.

---

### Task 1: Contract tests RED

**Files:**
- Modify: `tests/supply-requests-queue-contract.test.mjs`

**Interfaces:**
- Consumes: existing contract test style (regex against source files)
- Produces: failing assertions that define the new contract

- [x] **Step 1: Write failing assertions** for cancelled bucket, 5 tabs, items in payload, no amount/invoice in queue DTO, card UI rules
- [x] **Step 2: Run** `node --test tests/supply-requests-queue-contract.test.mjs` and confirm RED

### Task 2: API GREEN

**Files:**
- Modify: `public/api/src/SupplyWork.php` (`erp_supply_work_queue_bucket`, `erp_supply_work_requests_queue`)

**Interfaces:**
- Consumes: `erp_supply_requests` rows + latest `erp_approvals` per `request_code`
- Produces: queue DTO with `queueStatus` including `cancelled`, `items: [{name, quantity, unit, category}]`; no `amount`/`invoice` fields

- [x] **Step 1: Map** `ERP_INVOICE_STATUS_REJECTED` and `'Отменен'` → `'cancelled'`; update docblock
- [x] **Step 2: Second query** for items by request codes (LIMIT 200 parent set); attach in PHP
- [x] **Step 3: Drop** `amount`/`invoice` from JSON payload
- [x] **Step 4: Re-run** API-related contract tests until green for PHP assertions

### Task 3: Client types + UI GREEN

**Files:**
- Modify: `app/utils/erp-supply.ts`
- Modify: `app/pages/supply-requests-queue.vue`

**Interfaces:**
- Consumes: updated API DTO
- Produces: 5 tabs; card = code + date, contents, employee/department; no money/invoice/platform row

- [x] **Step 1: Extend** `ErpSupplyQueueStatus` with `'cancelled'`; add `items` to `ErpSupplyQueueRequest`; remove amount/invoice from type
- [x] **Step 2: Update** TABS, emptyMessage, card markup/styles
- [x] **Step 3: Run** full contract tests + typecheck

### Task 4: Staging deploy + smoke

**Files:** none (deploy scripts)

- [x] **Step 1: Generate** static + upload API `SupplyWork.php` and static assets to staging
- [x] **Step 2: Smoke** `/api/supply-work/requests-queue` shape (cancelled present if any reject; items array)
- [x] **Step 3: Note** phone acceptance for user

## Accepted behavior (do not re-ask)

Rejected invoice moves request from «Новые» to «Отменен». Re-creating an invoice still works from the invoice form list.
