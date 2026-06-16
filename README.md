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
- **Тёмная тема**

## Стек

Nuxt 4 · Vue 3 · TypeScript · Pinia · TanStack Query · Appwrite · Manrope

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

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production-сборка |
| `npm run generate` | Static export |
| `npm run preview` | Preview сборки |
