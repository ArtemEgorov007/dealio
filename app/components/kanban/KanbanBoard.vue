<script setup lang="ts">
import {ref} from 'vue'
import {useQueryClient} from '@tanstack/vue-query'

import {useKanbanQuery} from '~/components/kanban/useKanbanQuery'
import type {ICard, IColumn} from '~/components/kanban/kanban.types'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {useAuthStore} from '~~/store/auth.store'

const authStore = useAuthStore()
const queryClient = useQueryClient()

const dragCardRef = ref<ICard | null>(null)
const sourceColumnRef = ref<IColumn | null>(null)

const {data, isLoading, isError, error} = useKanbanQuery()

const invalidateBoard = () => {
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}

const handleDragStart = (card: ICard, column: IColumn) => {
  dragCardRef.value = card
  sourceColumnRef.value = column
}

const handleDragEnd = () => {
  dragCardRef.value = null
  sourceColumnRef.value = null
}

const handleCardMoved = () => invalidateBoard()
</script>

<template>
  <div class="kanban-page">
    <header class="kanban-header">
      <div class="kanban-header__left">
        <h1 class="kanban-title">Мой трекер</h1>
        <div v-if="authStore.isGuest" class="kanban-demo-badge">
          <span class="demo-dot"></span>
          Демо-режим
        </div>
      </div>
      <p class="kanban-subtitle">Идеи, задачи и желания — всё в одном kanban</p>
    </header>

    <KanbanStats />

    <div v-if="isLoading" class="kanban-state">
      <div class="kanban-spinner">
        <div class="spinner-ring"></div>
      </div>
      <p class="kanban-state__text">Загрузка данных...</p>
    </div>

    <div v-else-if="isError" class="kanban-state kanban-state--error">
      <div class="error-icon">
        <Icon name="heroicons:exclamation-triangle" size="28"/>
      </div>
      <p class="kanban-state__text">Ошибка загрузки: {{ (error as Error).message }}</p>
      <button class="retry-button" @click="invalidateBoard">
        <Icon name="heroicons:arrow-path" size="14"/>
        Повторить
      </button>
    </div>

    <div v-else-if="data?.length" class="kanban-board-wrap">
      <div class="kanban-board">
        <KanbanColumn
            v-for="column in data"
            :key="column.id"
            :column="column"
            :drag-card="dragCardRef"
            :source-column="sourceColumnRef"
            @dragstart="handleDragStart"
            @dragend="handleDragEnd"
            @card-moved="handleCardMoved"
        />
      </div>
    </div>

    <div v-else class="kanban-state kanban-state--empty">
      <div class="empty-icon">
        <Icon name="heroicons:rectangle-stack" size="32"/>
      </div>
      <p class="kanban-state__text">Нет данных для отображения</p>
      <p class="kanban-state__hint">Добавьте первую карточку, чтобы начать</p>
    </div>
  </div>

  <KanbanSlideover/>
</template>

<style scoped lang="sass">
.kanban-page
  padding: var(--spacing-6) var(--spacing-6) var(--spacing-8)

  @media (max-width: 768px)
    padding: var(--spacing-4)

.kanban-header
  margin-bottom: var(--spacing-6)

.kanban-header__left
  display: flex
  align-items: flex-start
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-1)

.kanban-demo-badge
  display: inline-flex
  align-items: center
  gap: 6px
  padding: 3px 10px
  background-color: rgba(245, 158, 11, 0.1)
  color: #b45309
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: 700
  letter-spacing: 0.3px
  border: 1px solid rgba(245, 158, 11, 0.2)

[data-theme="dark"] .kanban-demo-badge
  color: #fbbf24
  background-color: rgba(251, 191, 36, 0.1)
  border-color: rgba(251, 191, 36, 0.2)

.demo-dot
  width: 6px
  height: 6px
  border-radius: 50%
  background-color: currentColor
  animation: pulse-dot 2s ease-in-out infinite

@keyframes pulse-dot
  0%, 100%
    opacity: 1
  50%
    opacity: 0.4

.kanban-title
  font-size: var(--font-size-3xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  line-height: 1.1

.kanban-subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  font-weight: 500

.kanban-state
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  padding: var(--spacing-12)
  color: var(--color-text-secondary)
  min-height: 300px
  gap: var(--spacing-3)

.kanban-state__text
  font-size: var(--font-size-base)
  font-weight: 500
  color: var(--color-text-secondary)
  text-align: center

.kanban-state__hint
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  text-align: center

.kanban-spinner
  width: 40px
  height: 40px
  position: relative

.spinner-ring
  width: 100%
  height: 100%
  border: 3px solid var(--color-border)
  border-top: 3px solid var(--color-primary)
  border-radius: 50%
  animation: spin 0.8s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)

.kanban-state--error
  .error-icon
    width: 56px
    height: 56px
    border-radius: var(--radius-xl)
    background-color: rgba(239, 68, 68, 0.08)
    display: flex
    align-items: center
    justify-content: center
    color: var(--color-danger)

.kanban-state--empty
  .empty-icon
    width: 64px
    height: 64px
    border-radius: var(--radius-xl)
    background-color: var(--color-bg-secondary)
    display: flex
    align-items: center
    justify-content: center
    color: var(--color-text-muted)

.retry-button
  display: inline-flex
  align-items: center
  gap: var(--spacing-2)
  padding: 7px var(--spacing-4)
  background-color: var(--color-button-primary-bg)
  color: white
  border: none
  border-radius: var(--radius-md)
  font-size: var(--font-size-sm)
  font-weight: 600
  cursor: pointer
  transition: all var(--transition-normal) ease

  &:hover
    background-color: var(--color-button-primary-bg-hover)
    transform: translateY(-1px)

.kanban-board-wrap
  overflow-x: auto
  padding-bottom: var(--spacing-4)

  &::-webkit-scrollbar
    height: 6px

  &::-webkit-scrollbar-track
    background: transparent

  &::-webkit-scrollbar-thumb
    background: var(--color-border-hover)
    border-radius: var(--radius-full)

.kanban-board
  display: flex
  gap: var(--spacing-4)
  min-width: max-content
</style>
