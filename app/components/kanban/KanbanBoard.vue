<script setup lang="ts">
import {ref} from 'vue'
import {useQueryClient} from '@tanstack/vue-query'

import {useKanbanQuery} from '~/components/kanban/useKanbanQuery'
import type {ICard, IColumn} from '~/components/kanban/kanban.types'
import {useAuthStore} from '~~/store/auth.store'

const authStore = useAuthStore()

const dragCardRef = ref<ICard | null>(null)
const sourceColumnRef = ref<IColumn | null>(null)

const queryClient = useQueryClient()

const {data, isLoading, isError, error} = useKanbanQuery()

const handleDragStart = (card: ICard, column: IColumn) => {
  dragCardRef.value = card
  sourceColumnRef.value = column
}

const handleDragEnd = () => {
  dragCardRef.value = null
  sourceColumnRef.value = null
}

const handleCardMoved = () => {
  queryClient.invalidateQueries({queryKey: ['deals']})
  queryClient.invalidateQueries({queryKey: ['deals-stats']})
}

const store = useDealSlideStore();

const retry = () => {
  queryClient.invalidateQueries({queryKey: ['deals']})
}
</script>

<template>
  <div class="kanban-container">
    <header class="kanban-header">
      <div class="kanban-header__top">
        <h1 class="kanban-title">CRM Dashboard</h1>
        <div v-if="authStore.isGuest" class="kanban-demo-badge">
          <Icon name="radix-icons:eye-open" size="14"/>
          Демо-режим
        </div>
      </div>
      <p class="kanban-subtitle">Управление сделками в режиме Kanban</p>
    </header>

    <KanbanStats />

    <div v-if="isLoading" class="kanban-state">
      <div class="spinner"/>
      <p>Загрузка данных...</p>
    </div>

    <div v-else-if="isError" class="kanban-state">
      <p class="error-message">Ошибка загрузки данных: {{ (error as Error).message }}</p>
      <button class="retry-button" @click="retry">Повторить попытку</button>
    </div>

    <div v-else-if="data?.length" class="kanban-board">
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

    <div v-else class="kanban-state">
      <p>Нет данных для отображения</p>
      <p class="empty-state-hint">Создайте свою первую сделку, чтобы начать работать</p>
    </div>
  </div>

  <KanbanSlideover/>
</template>

<style scoped lang="sass">
.kanban-container
  padding: var(--spacing-6)
  overflow-x: auto

.kanban-header
  margin-bottom: var(--spacing-6)

.kanban-header__top
  display: flex
  align-items: center
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-1)

.kanban-demo-badge
  display: inline-flex
  align-items: center
  gap: var(--spacing-1)
  padding: 2px var(--spacing-2)
  background-color: rgba(251, 191, 36, 0.15)
  color: #d97706
  border: 1px solid rgba(251, 191, 36, 0.4)
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: var(--font-weight-medium)

.kanban-title
  font-size: var(--font-size-3xl)
  font-weight: var(--font-weight-bold)
  color: var(--color-text)

.kanban-subtitle
  font-size: var(--font-size-base)
  color: var(--color-text-secondary)

.kanban-state
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  padding: var(--spacing-8)
  color: var(--color-text-secondary)
  min-height: 400px

.spinner
  width: 32px
  height: 32px
  border: 4px solid var(--color-border)
  border-top: 4px solid var(--color-primary)
  border-radius: 50%
  animation: spin 1s linear infinite
  margin-bottom: var(--spacing-4)

@keyframes spin
  to
    transform: rotate(360deg)

.kanban-board
  display: flex
  gap: var(--spacing-4)
  min-width: 800px

.error-message
  color: var(--color-error-text)
  margin-bottom: var(--spacing-4)
  text-align: center

.retry-button
  background-color: var(--color-primary)
  color: white
  border: none
  padding: var(--spacing-2) var(--spacing-4)
  border-radius: var(--radius-md)
  cursor: pointer
  font-weight: var(--font-weight-medium)
  transition: background-color var(--transition-normal) ease

  &:hover
    background-color: var(--color-primary-hover)

.empty-state-hint
  margin-top: var(--spacing-2)
  font-size: var(--font-size-sm)
  color: var(--color-text-tertiary)
  text-align: center
  max-width: 300px
</style>