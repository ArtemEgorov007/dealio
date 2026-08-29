# Архитектура ERP «Морфлот Технология»

Карта проекта для того, кто подключается к работе (человек или AI-агент).
Описывает состояние на 29.08.2026 — как всё устроено на самом деле, а не как
задумывалось.

## Что это

Внутренняя производственная ERP: бирки, промеры, упаковка, сдача работ, склад,
кадры, согласование счетов. Прод — `https://erp-mt.ru`, стенд —
`https://erp-mt.online`.

## Два продукта в одном репозитории

Здесь живут **две** несвязанные системы:

| | Роуты | Бэкенд |
|---|---|---|
| **ERP** (рабочий продукт) | `/register`, `/workshop`, `/badges`, `/scan-*`, `/warehouse*`, `/personnel`, `/approvals`, `/reports` | GAS + SQL API |
| **Dealio** (kanban-трекер) | `/board`, `/login`, `/tasks`, `/wishlist`, `/archive`, `/settings`, `/dashboard`, `/ideas`, `/help` | Appwrite |

Разводит их `app/middleware/erp-flow.global.ts` (списки `ERP_ROUTES` и
`DEALIO_PREFIXES`). У ERP свой layout `erp.vue` со светлой темой; глобальный
дефолт в `app/assets/css/variables.css` — тёмный, он от Dealio.

Kanban-часть — около 4700 строк и зависимость `appwrite`, которые попадают
в каждую сборку ERP. Если трекер больше не нужен, его вынос — самая крупная
оставшаяся уборка.

## Бэкенд: миграция GAS -> SQL

Сейчас работают **два** бэкенда одновременно, идёт переезд:

- **Google Apps Script + Google Таблицы** — исторический. Скрипты в `scripts/`
  (`erp-gas-webapp.js`, `warehouse-gas-webapp.js`), деплой в Google вручную
  через `clasp`.
- **PHP API + MySQL** — новый, в `public/api/`. Роутер, авторизация с сессиями,
  кадры, бирки, сдача, отчёты, согласования, push.

Переключает `NUXT_PUBLIC_ERP_BACKEND_MODE` (`gas` по умолчанию, `sql` — новый
путь). Маршрутизацию делает `app/utils/erp-sheets.ts`: каждая операция сама
выбирает GAS, SQL API, CSV или мок. Поэтому файл большой — он временный
диспетчер и будет сжиматься по мере отключения GAS.

Причина переезда: связка «браузер -> GAS -> Sheets» оказалась нестабильной под
нагрузкой (периодические `Unknown action` и обрывы), см.
`docs/superpowers/specs/2026-08-27-sql-backend-migration-design.md`.

## Слои фронтенда

```
app/pages/*.vue          экраны (плоские роуты, без вложенности)
app/layouts/erp.vue      каркас ERP: шапка, таб-бар, светлая тема
app/components/erp/      ERP-компоненты (ErpScreen, ErpActionSheet, ...)
app/components/ui/       примитивы (кнопка, инпут, селект)
app/composables/         переиспользуемые сценарии
app/utils/erp/transport  транспорт к GAS: конфиг, запросы, конверт ответа
app/utils/erp-sheets.ts  диспетчер операций GAS <-> SQL API
app/utils/erp-api.ts     клиент нового PHP API
store/erp-*.store.ts     сессия сотрудника, очередь согласований
```

Общее вынесено и переиспользуется:

- `app/utils/text-search.ts` — нормализация и фильтрация списков (была
  скопирована в 4 страницы).
- `app/composables/useWarehouseCatalog.ts` — сценарий «категории -> позиции ->
  поиск» для «Приёма» и «Выдачи» (был продублирован построчно).

## Миграции БД

**Единственный каталог — `public/api/migrations/`.** Только он деплоится
(`scripts/deploy-staging-api.py` заливает `public/api/`) и только его читает
рантайм (`erp_apply_migrations` в `Approvals.php`, `Push.php`).

Второй каталог `database/migrations/` существовал раньше и разъехался: из
рантайм-копии выпала `004_erp_catalog_sync.sql`, и таблица
`erp_catalog_sync_runs` не создавалась на чистой базе, хотя код в неё пишет.
Возврат второго каталога и разрывы в нумерации ловит
`tests/migrations-single-source-contract.test.mjs`.

## Проверки

```bash
npm run verify      # всё сразу: контрактные тесты, PHP-тесты, типы, линт
npm run test:contract   # JS-тесты (node --test)
npm run test:php        # тесты PHP-бэкенда
npm run typecheck       # vue-tsc
npm run lint            # eslint
```

`npm run verify` вызывается в CI перед сборкой и деплоем.

Тесты в `tests/*.test.mjs` в основном **контрактные**: читают исходник как
текст и проверяют, что в нём есть нужные вызовы и нет запрещённых. Это ловит
регрессии архитектуры, но не поведение — поведенческие тесты есть там, где
логика чистая (например `tests/text-search.test.mjs`).

Файлы `tests/php/*-test.php` — тесты (запускаются без аргументов). Прочие
файлы в `tests/php/` — диагностические инструменты, им нужен сценарий
аргументом, в автопрогон они не входят.

## Деплой

1. Пуш в `main` -> CI собирает и выкладывает на **staging**.
2. Ручная проверка `https://erp-mt.online`.
3. Actions -> Run workflow -> `production`, с подтверждением в GitHub
   Environment.

Статику деплоит CI по SFTP; PHP API — отдельно
`scripts/deploy-staging-api.py`. Реквизиты только в приватных настройках
окружения, в репозитории их нет. Конфиг API живёт на сервере вне webroot.

`public/api/vendor/` не в git — воспроизводится из `composer.lock`
(`composer install --no-dev`).

## Что стоит сделать дальше

1. Решить судьбу kanban-части (см. выше) — самая большая разовая уборка.
2. Дорезать `erp-sheets.ts` по доменам (бирки, кадры, сдача, согласования)
   по мере отключения GAS-путей.
3. Единая обработка ошибок: сейчас `error instanceof Error ? ... : '...'`
   повторяется в ~19 местах.
4. Автоматический повтор запроса к складскому GAS: баланс периодически
   отвечает ошибкой связи сразу после записи, сейчас лечится только ручной
   кнопкой «Повторить».
5. Проверить автопродление SSL (Let's Encrypt, ~90 дней).
