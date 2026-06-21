# Dealio — трекер идей, задач и желаний

Kanban-доска для личных идей, задач и wishlist. Nuxt 4 + Appwrite + Vue Query.

## Возможности

- **Kanban-доска** — колонки: Идеи · Задачи · В работе · Готово · Wishlist
- **Карточки** — тип (Идея / Задача / Wishlist), приоритет, стоимость для wishlist
- **Drag & Drop** — перетаскивание между колонками
- **Slideover** — редактирование, комментарии, архив
- **Сводка** — статистика и прогресс по доске
- **Архив** — демо (localStorage) и аккаунт Appwrite (локальный буфер + удаление с доски)
- **Демо-режим** — без регистрации, mock-данные
- **Тёмный UI** — монохромный, Vercel-style (без переключателя тем)

## Стек

Nuxt 4 · Vue 3 · TypeScript · Pinia · TanStack Query · Appwrite

## Запуск

```bash
npm install
npm run dev
npm run generate   # static для GitHub Pages
```

## Структура

```
app/pages/              — роуты (/, /archive, /settings, /login, …)
app/components/kanban/  — доска, stats, slideover, CreateCard
app/utils/              — Appwrite API, маппинг price/status
store/                  — auth, board, card-slide, auth-archive
types/cards.types.ts    — типы (Appwrite collection `deals`)
```

## Appwrite + GitHub Pages

Проект: `crm-system-nuxt-record123` · БД: `data-base` · коллекции: `deals`, `comments`.

Прод: [artemegorov007.github.io/dealio](https://artemegorov007.github.io/dealio/)

**Схема `deals` (важно для фронта):**

| Поле | Ограничения |
|------|-------------|
| `price` | 10 000 – 1 000 000 (для не-wishlist — sentinel 10 000) |
| `status` | `todo` · `to-be-agreed` · `in-progress` · `produced` · `done` |

Маппинг UI ↔ Appwrite: `app/utils/appwrite-status.ts`, `app/utils/card-priority.ts`.

В [Appwrite Console](https://cloud.appwrite.io/console/project-fra-crm-system-nuxt-record123):

- **Platforms** — `localhost`, `artemegorov007.github.io`
- **Auth** — Email/Password
- **deals / comments** — Row security ON; Users: Create на коллекции

Деплой: push в `main` → GitHub Actions (`NUXT_APP_BASE_URL=/dealio/`).

## Дизайн

Текущий UI — монохромный тёмный стиль в духе Vercel/Linear: чёрный фон, тонкие границы вместо заливок/градиентов, цвет типа карточки передаётся точкой-индикатором (для Wishlist — ценой). Денежные суммы — без значка ₽, числа — моноширинным шрифтом.

Редизайн (2026-06-18) сделан в паре с Claude Code:

1. **Брейнсторм** — через визуальную песочницу (`superpowers:brainstorming`) перебрали несколько направлений (Editorial / Warm minimal / Vibrant), затем после ревью ушли от «Vibrant» (градиенты, похожие на стиль 2017 года) к строгой Vercel-эстетике; отдельно проитерировали композицию доски (карточки-блоки → плотные строки) и метрики (карточки → текстовая строка → пилюли-чипы).
2. **Спека и план** — зафиксированы в `docs/superpowers/specs/` и `docs/superpowers/plans/`.
3. **Реализация** — `superpowers:subagent-driven-development`: 7 задач плана, каждая — отдельный имплементер-субагент + ревью спеки/качества, плюс финальный ревью всей ветки перед мёрджем.

## Vibecoding (Cursor, 2026-06-18)

После редизайна проект допилили в Cursor — правки по QA, mobile и UX. Коммиты `dc0e6ca` → `410dd7d`.

### Архив и layout

- **Архив при большом списке** — один scroll-контейнер, строки как на доске, nav не уезжает; stress-тест 100+ карточек на главной без поломки layout.
- **Удаление навсегда** — toast с откатом **10 секунд**: живой счётчик, progress bar, кнопка «Отменить» в стиле `UiButton` (`outline` + `sm`); восстановление через `restore` в store (guest + auth).

### Toast-уведомления

- **UApp + Toaster** — `useAppToast`, toast на мутациях (архив, create, update, move, comments).
- **Видимость** — явные CSS-оверрайды (Nuxt UI Tailwind не применялся → toast был за экраном).
- **Позиция и анимация** — desktop: правый верхний угол, выезд/заезд справа; mobile: над bottom nav, без перекрытия; ширина по контенту; при открытом slideover toast сдвигается влево.
- **Общая кривая** — `--dealio-motion-duration` / `--dealio-motion-ease` (как у slideover).

### Kanban и mobile

- **Drag на мобилке** — безопасный drag payload, пустой drag-image, guards на drop, `pointer-events: none` на ссылках во время drag (не открывались сторонние сайты).
- **Overflow контента** — ellipsis для длинных названий и цен wishlist в карточках, архиве, slideover, stats-чипах; комментарии с `overflow-wrap`.

### Slideover и инфраструктура

- **Slideover** — симметричный exit через `<Transition>` + `:duration="{ enter: 240, leave: 240 }"`.
- **@vueuse/nuxt** — `onClickOutside` в Select, `useIntervalFn` для prune архива.
- **SEO** в `nuxt.config.ts`, кастомная **`error.vue`**, Manrope через `--font-family-base`.

### Ключевые файлы

| Область | Файлы |
|---------|--------|
| Toast | `app/composables/useAppToast.ts`, `app/assets/css/toast-overrides.css`, `app/app.vue` |
| Архив | `app/pages/archive.vue`, `store/board.store.ts`, `store/auth-archive.store.ts` |
| Drag | `app/components/kanban/kanban-drag.ts`, `kanban-effects.css` |
| Layout | `app/layouts/default.vue`, `Slideover.vue` |
| Overflow | `KanbanCard.vue`, `KanbanColumn.vue`, `archive.vue`, `Comments.vue`, `Top.vue` |

## Коммерческий проект: CRM «Выдача бирок» (Морфлот Технология)

Внутри Dealio выросла отдельная коммерческая CRM для промышленного заказчика («Морфлот Технология» — антикоррозионная защита, изоляция, судоремонт) — задача поступила от заказчика как «оптимизируй процесс с гугл-таблицей», без готового ТЗ на архитектуру. Прод: [artemegorov007.github.io/dealio/badges](https://artemegorov007.github.io/dealio/badges).

### Бизнес-задача

У заказчика уже был рабочий Telegram-бот (FindTagMFT) для выдачи маркировочных бирок цехам и Google-таблица на тысячи строк с историей выдач. Узкое место — сама выдача бирки на месте, на телефоне у мастера, требовала либо бота, либо ручного поиска в таблице. Нужен был веб-экран без логина, который выдаёт бирку за 3 тапа и сам пишет в тот же журнал, что и бот.

### Подход к оптимизации, а не просто «фича»

- **Не трогать работающий процесс.** Бот и его Apps Script остались как есть — новый веб-апп — отдельный задеплоенный Apps Script-проект, читающий и пишущий в ту же таблицу. Цена ошибки в живом бизнес-процессе выше цены лишнего отдельного деплоя.
- **Совпадение схемы данных, а не изобретение новой.** Журнал выдачи пишется ровно в те же колонки, что и у бота (`День / Инженер / Бирка / Дата / Цех`), а бирка помечается выданной в её исходном листе тем же способом (дата в колонку C) — иначе бот и веб-апп начали бы конфликтовать за одни и те же бирки.
- **Нашли и закрыли реальный риск дублирования выдачи**, не дожидаясь жалобы: при прямом заходе на `/badges` (закладка, перезапуск телефона) экран раньше зависал без сотрудника и цеха в контексте — поправили роутинг (мидлварь не переживал конечный слэш от GitHub Pages); отдельно — флаг `issued` в сессии, чтобы повторный заход на экран выдачи (например, кнопкой «вперёд» в браузере) не писал вторую строку в журнал.
- **Шаг подтверждения перед записью.** Тап по бирке в списке из 300+ строк — случайный тап по соседней не редкость. Раньше запись в журнал и пометка «выдано» происходили мгновенно по тапу; теперь сначала экран «Выдать бирку» с подтверждением, «Это не та бирка» возвращает к списку без последствий. Цена ошибки (ручная правка в таблице заказчика) выше одного лишнего тапа.
- **Снизили порог входа до нуля**: цех/тег для подключения журнала зашиты в сборку через GitHub Actions secret — мастеру не нужно ничего настраивать на телефоне.

### Экраны (4 шага, без логина)

1. **Регистрация** — ФИО один раз, дальше не спрашивается
2. **Выбор цеха** — Колпино / Волхонка, запоминается, это стартовый экран при повторном открытии
3. **Выбор бирки** — список из таблицы, поиск по подстроке, счётчик «Найдено N из M» — на цехах с 300+ бирками без поиска находить нужную было неудобно
4. **Получение бирки** — подтверждение выдачи → запись в журнал и пометка бирки выданной → копирование в буфер; при ошибке записи — кнопка «Повторить»; короткая вибрация на успехе, двойная на ошибке (Android; в Safari/iOS API недоступен); кнопки прилипают к низу экрана на любом размере

### Нативность на телефоне

- **PWA** — `manifest.json` + иконки 192/512 из логотипа заказчика; ставится на экран телефона как обычное приложение, открывается сразу в CRM-потоке, без адресной строки браузера
- **Фирменная светлая тема** (`#FBFBFB` / `#016ED7` / `#3897ED` / `#D8FAFF`) и логотип «Морфлот Технология» — только на 4 экранах выдачи, kanban-трекер Dealio остаётся тёмным

### Ключевые файлы

| Область | Файлы |
|---------|-------|
| Экраны выдачи | `app/pages/register.vue`, `workshop.vue`, `badges.vue`, `receipt.vue` |
| Поток/роутинг | `app/middleware/crm-flow.global.ts` |
| Сессия выдачи (защита от дублей) | `store/crm-session.store.ts` |
| Google Sheets / GAS | `app/utils/crm-sheets.ts`, `scripts/crm-gas-webapp.js` |
| Фирменная тема (только CRM-экраны) | `app/assets/css/crm-theme.css` |
| PWA | `public/manifest.json`, `public/icon-192.png`, `public/icon-512.png` |
| Подключение журнала на устройстве | `app/pages/crm-setup.vue` |

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production-сборка |
| `npm run generate` | Static export |
| `npm run preview` | Preview сборки |
