# SQL Staging QA — auth + Кадры + бирки + сдача

Дата: 2026-08-27  
Контур: `https://erp-mt.online` (`erpBackendMode: sql`)  
Прод: `https://erp-mt.ru` остаётся на GAS (маркер `erpBackendMode` отсутствует → default gas)

## Вердикт

**Staging QA пройден для SQL-каталога бирок и сдачи. Production не
переключать.**

На staging применены миграции 001–004. Начальная сверка Google → SQL успешно
обработала 1001 активную бирку и мягко архивировала 1 отсутствующую в источнике
позицию. История выдач не удаляется. Проверки выполнялись только на staging;
созданные тестовые выдача и сдача были отменены.

## Прогон 1 (API + browser) — auth/personnel

| # | Сценарий | Результат |
|---|----------|-----------|
| A1–D3 | см. предыдущий прогон | **22/22 PASS** |

## Прогон 2 — бирки (SQL wave 1)

| # | Сценарий | Результат |
|---|----------|-----------|
| E1–E10 | catalog / issue / idempotency / delete / browser / prod | **10/10 PASS** |

## Прогон 3 — сдача (SQL wave 2)

| # | Сценарий | Результат |
|---|----------|-----------|
| F1 | `POST /api/handover/entries` → entry | PASS |
| F2 | Idempotency-Key replay без дубля | PASS |
| F3 | Повтор той же бирки → 409 «Бирка уже записана» | PASS |
| F4 | `GET /api/handover/entries/today` → 1; DELETE undo → 0 | PASS |
| F5 | После undo повторная запись той же бирки ок | PASS |
| F6 | `qa.staging` без `handover` → 403 | PASS |
| F7 | Browser: `/handover-shift` «Сдано сегодня: 1» | PASS |
| F8 | Browser: отмена сдачи → «За смену сдач пока не было» | PASS |

Итого сдача: **8/8 PASS**.

## Прогон 4 — server-side scope и восстановление сессии

| Сценарий | Результат |
|---|---|
| Вход менеджера → `GET /auth/me` | PASS |
| Каталог Колпино доступен авторизованному пользователю | PASS |
| Неизвестная бирка отклоняется сервером (409) | PASS |
| Выдача → отмена той же записи | PASS |
| Сдача → отмена той же записи | PASS |
| Менеджер видит созданную за смену запись | PASS (1) |
| Исполнитель с доступом к биркам не видит запись менеджера | PASS (0) |

Тестовая учётная запись исполнителя после проверки отключена; её сессия
отозвана.

## Прогон 5 — пользовательский UI-регресс «Кадров»

| Сценарий | Результат |
|---|---|
| Вход менеджера в staging | PASS |
| Плитка «Кадры» открывает рабочий раздел, без текста «В разработке» | PASS |
| Переход в отдел → список сотрудников → «Все отделы» | PASS |
| Карточка сотрудника блокирует прокрутку фона и имеет собственный scroll-контейнер | PASS (DOM/CSS) |
| Обновление `/personnel/` не разлогинивает пользователя | PASS |
| «Кадры» остаются визуально активными после canonical trailing slash | PASS |

Выпущен staging-статический релиз `manual-staging-qa-2026-08-27`. Для уже
открытой до релиза вкладки требуется обычное обновление страницы: она может
держать старый client bundle в кэше.

## Прогон 6 — согласования (API auth boundary)

Локально (до выкладки на staging):

| # | Сценарий | Результат |
|---|----------|-----------|
| G1 | `erp_approvals_current` / `erp_approvals_decide`: `erp_require_user` до bridge | PASS (source contract) |
| G2 | Оба handler: `erp_require_permission(..., 'approvals')` до bridge | PASS (source contract) |
| G3 | Нет сессии → probe `401 unauthorized` | PASS |
| G4 | Сессия без `approvals` → probe `403 forbidden` | PASS |
| G5 | PHP adapter + bridge contract tests | PASS |

Staging HTTPS (2026-08-28, после деплоя API):

| # | Сценарий | Результат |
|---|----------|-----------|
| G6 | Без cookie: `GET /api/approvals` | **401 unauthorized** |
| G7 | Без cookie: `POST /api/approvals/decisions` | **401 unauthorized** |
| G10 | `qa.staging` без `approvals`: `GET /api/approvals` | **403 forbidden** |
| G11 | `qa.staging` без `approvals`: `POST /api/approvals/decisions` | **403 forbidden** |

Проверка: `python3 scripts/staging-approvals-auth-smoke.py` → PASS.

Ожидается после Task 5 (bridge config):

| # | Сценарий | Ожидание |
|---|----------|----------|
| G12 | Пользователь с `approvals=true` без bridge config | **503 approvals_unavailable** |

## Не в этом гейте

- Полный визуальный регресс интерфейсов мобильного и desktop — отдельный гейт
- UI-полировка Кадров / импорт сотрудников — отдельный гейт
- Сдача на SQL — проверена на staging
- UI `/approvals` (карточки, просмотр счёта) — Task 4, отдельный гейт
- Bridge GAS + `approvals.bridge_*` в private config — Task 5
- Промеры / упаковка / склад на SQL — следующая волна
- Переключение прода на SQL
