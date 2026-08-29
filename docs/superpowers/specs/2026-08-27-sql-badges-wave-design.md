# SQL Operational Wave 1 — Badges (бирки)

Дата: 2026-08-27  
Контур: staging `erp-mt.online` only. Production остаётся на GAS до отдельного ОК.

## Goal

Перевести выдачу бирок и журнал «за смену» на same-origin PHP/MySQL, сохранив текущий UX: workshop → badges → confirm → receipt → shift.

## Scope (MVP)

| Capability | GAS today | SQL |
|------------|-----------|-----|
| Список бирок цеха | лист «Выдача» | `erp_workshop_badges` |
| Выдача | append «Журнал выдачи бирок» | `erp_badge_issues` + `erp_shift_events` |
| Список за сегодня | filter journal | `erp_badge_issues` where today, not deleted |
| Удаление | deleteRow | soft-delete `deleted_at` + revoke shift event |
| Счётчик на /workshop | issuedToday scope | same query, manager = all / executor = self |

Out of scope this wave: handover, measurements, packing, warehouse, mutating catalog «Выдача».

## Tables

- `erp_workshop_badges(workshop_id, badge_hash, badge_content, sort_order)`
- `erp_badge_issues(id, user_id, workshop_id, badge_content, issued_at, deleted_at, idempotency_key)`
- Reuse `erp_shift_events` with `event_type='badge_issue'`, `business_key='badge_issue:{id}'`

## API

- `GET /api/badges?workshop=kolpino|volkhonka` → `{badges: string[]}`
- `POST /api/badges/issues` body `{workshop, badgeContent, idempotencyKey?}` → `{entry:{id,row,badge,time}}`
- `GET /api/badges/issues/today?workshop=&fio=` → `{entries:[...]}` (empty fio = all for managers; clients pass scope)
- `DELETE /api/badges/issues/{id}` → `{ok:true}`

Permission: `badges`. Session required. Origin cookie auth as personnel.

## Acceptance

1. Catalog loads for Колпино and Волхонка without GAS.
2. Issue writes journal row visible on /shift for same user/workshop today.
3. Duplicate Idempotency-Key does not double-write.
4. Delete removes from today’s list; counter decreases.
5. Executor without `badges` gets 403.
6. Production build remains `erpBackendMode: gas`.

## Rollback

Set staging `NUXT_PUBLIC_ERP_BACKEND_MODE=gas` and redeploy static; SQL tables remain unused.
