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

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production-сборка |
| `npm run preview` | Preview сборки |
