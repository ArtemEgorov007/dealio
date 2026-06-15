# Dealio — трекер идей, задач и желаний

Kanban-доска для личных идей, задач и wishlist. Nuxt 3 + Appwrite + Vue Query.

## Возможности

- **Kanban-доска** — колонки: Идеи → Запланировано → В работе → На проверке → Готово
- **Карточки** — название, категория (Идеи / Задачи / Желания / Личное), приоритет 1–5
- **Drag & Drop** — перетаскивание между колонками
- **Slideover** — детали карточки и комментарии
- **Демо-режим** — без регистрации, с mock-данными
- **Тёмная тема**

## Стек

Nuxt 3 · Vue 3 · TypeScript · Pinia · TanStack Query · Appwrite · Manrope

## Запуск

```bash
npm install
npm run dev
```

## Структура

```
app/pages/          — роуты (/, /ideas, /tasks, /wishlist, /archive, /login)
app/components/kanban/ — доска, колонки, карточки, CreateCard, slideover
store/              — auth, card-slide
types/cards.types.ts — типы (Appwrite collection `deals`)
```

## Appwrite + GitHub Pages

Проект: `crm-system-nuxt-record123` · БД: `data-base` · коллекции: `deals`, `comments`.

В [Appwrite Console](https://cloud.appwrite.io/console/project-fra-crm-system-nuxt-record123) настроено:

- **Platforms** — `localhost`, `artemegorov007.github.io`
- **Auth** — Email/Password включён
- **deals / comments** — Users: Create на уровне таблицы; Row security включён; read/update/delete — на уровне документа из приложения

Деплой: push в `main` → GitHub Actions собирает с `NUXT_APP_BASE_URL=/dealio/`.

Демо-режим на `/login` работает без Appwrite; регистрация и свои карточки — только с аккаунтом.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production-сборка |
| `npm run preview` | Preview сборки |
