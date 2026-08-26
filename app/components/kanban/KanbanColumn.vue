<script setup lang="ts">
import type {IColumn} from '~/components/kanban/kanban.types'

import {computed, inject} from 'vue'
import {useQueryClient} from '@tanstack/vue-query'

import CreateCard from '~/components/kanban/CreateCard.vue'
import {KANBAN_DRAG_KEY} from '~/components/kanban/kanban-drag-context'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {isGuestSession} from '~~/store/auth.store'

const props = defineProps<{
  column: IColumn
}>()

const kanbanDrag = inject(KANBAN_DRAG_KEY)
if (!kanbanDrag) {
  throw new Error('KanbanColumn must be used inside KanbanBoard')
}

const queryClient = useQueryClient()

const isDragOver = computed(() => kanbanDrag.dropTargetColumnId.value === props.column.id)

const isMovingHere = computed(() => kanbanDrag.movingToColumnId.value === props.column.id)

const onCardCreated = () => {
  if (import.meta.client && isGuestSession()) return
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}
</script>

<template>
  <div
      class="kanban-column"
      :class="[
      `kanban-column--${column.id}`,
      { 'kanban-column--over': isDragOver }
    ]"
      :data-column-id="column.id"
  >
    <div class="column-header">
      <h2 class="column-title">{{ column.name }}</h2>
      <span class="column-count">{{ column.items.length }}</span>
    </div>

    <div class="column-content">
      <div v-if="isMovingHere" class="loading-indicator">
        <div class="spinner-mini"/>
        <span>Перемещение...</span>
      </div>

      <KanbanCard
          v-for="(card, index) in column.items"
          :key="card.id"
          :card="card"
          :column-id="column.id"
          :is-dragging="kanbanDrag.dragCard.value?.id === card.id"
          :style="{ animationDelay: `${index * 40}ms` }"
      />

      <div v-if="column.items.length === 0 && !isMovingHere" class="empty-column">
        <Icon name="heroicons:inbox" size="20" class="empty-icon"/>
        <span>Пусто</span>
      </div>
    </div>

    <CreateCard :status="column.id" @card-created="onCardCreated"/>
  </div>
</template>

<style scoped lang="sass">
.kanban-column
  width: 220px
  flex-shrink: 0
  display: flex
  flex-direction: column
  min-width: 0

  &--over
    .column-content
      outline-color: var(--color-white)
      background-color: rgba(255, 255, 255, 0.04)

    .empty-column
      border-color: transparent
      opacity: 0.45

.column-header
  display: flex
  justify-content: space-between
  align-items: center
  gap: var(--spacing-2)
  margin-bottom: var(--spacing-2)
  padding: 0 2px
  min-width: 0

.column-title
  margin: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  color: var(--color-text)
  min-width: 0
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.column-count
  font-size: var(--font-size-xs)
  font-weight: 500
  color: var(--color-text-muted)
  font-variant-numeric: tabular-nums
  flex-shrink: 0

.column-content
  display: flex
  flex-direction: column
  min-width: 0
  overflow: hidden
  border-radius: var(--radius-md)
  outline: 1px dashed transparent
  outline-offset: 4px
  transition: outline-color var(--transition-normal) var(--transition-ease), background-color var(--transition-normal) var(--transition-ease)

.empty-column
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  padding: var(--spacing-6) var(--spacing-3)
  min-height: 88px
  border: 1.5px dashed var(--color-border)
  border-radius: var(--radius-md)
  color: var(--color-text-muted)
  font-size: var(--font-size-sm)
  font-weight: 500
  transition: border-color var(--transition-normal) var(--transition-ease), opacity var(--transition-normal) var(--transition-ease)

  .empty-icon
    opacity: 0.4

.loading-indicator
  display: flex
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  padding: var(--spacing-3)
  color: var(--color-text-secondary)
  font-size: var(--font-size-xs)
  font-weight: 500

.spinner-mini
  width: 14px
  height: 14px
  border: 2px solid var(--color-border)
  border-top: 2px solid var(--color-primary)
  border-radius: 50%
  animation: spin 0.8s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)
</style>
