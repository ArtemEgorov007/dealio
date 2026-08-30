# SQL Operational Wave 2 — Handover (сдача)

Дата: 2026-08-27  
Контур: staging `erp-mt.online` only. Production остаётся на GAS.

## Goal

Перевести QR-сдачу и журнал «Сдачи» на same-origin PHP/MySQL, сохранив UX: scan → record → counter / handover-shift → undo.

## Scope

| Capability | GAS today | SQL |
|------------|-----------|-----|
| Запись сдачи | append «Сдача» + assert not recorded | `erp_handover_entries` |
| Список за сегодня | filter by date (+ optional fio) | same |
| Отмена | deleteRow | soft-delete `deleted_at` + revoke shift event |
| Дубль бирки | «Бирка уже записана» | 409 conflict on active hash |

Out of scope: measurements, packing, warehouse, badges catalog changes.

## Tables

- `erp_handover_entries(id, user_id, badge_content, badge_hash, handed_at, deleted_at, idempotency_key)`
- Reuse `erp_shift_events` with `event_type='handover'`, `business_key='handover:{id}'`

## API

- `POST /api/handover/entries` `{badgeContent, idempotencyKey?}` → `{entry:{id,row,badge,time}}`
- `GET /api/handover/entries/today?fio=` → `{entries:[...]}` (empty fio = all)
- `DELETE /api/handover/entries/{id}` `{fio,badgeContent}` → `{ok:true}`

Permission: `handover`. Session required. Engineer identity from session (not client-spoofed for write).

## Acceptance

1. Scan/record writes entry visible on `/handover-shift` today.
2. Same badge again → 409 «Бирка уже записана».
3. Undo removes from today; badge can be recorded again.
4. Idempotency-Key replay does not double-write.
5. User without `handover` → 403.
6. Production remains gas.

## Rollback

`NUXT_PUBLIC_ERP_BACKEND_MODE=gas` on staging redeploy; SQL tables unused.
