<script setup lang="ts">
import type {IColumn, ICard} from '~/components/kanban/kanban.types'
import type {EnumStatus} from '~~/types/cards.types'

import {ref} from 'vue'
import {useMutation, useQueryClient} from '@tanstack/vue-query'

import CreateCard from '~/components/kanban/CreateCard.vue'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {isGuestSession} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {updateCardStatus} from '~/utils/appwrite-cards'

const props = defineProps<{
  column: IColumn,
  dragCard: ICard | null,
  sourceColumn: IColumn | null
}>()

const emit = defineEmits<{
  (e: 'dragstart', card: ICard, column: IColumn): void
  (e: 'dragend'): void
  (e: 'card-moved'): void
}>()

const isDragOver = ref(false)
const queryClient = useQueryClient()
const boardStore = useBoardStore()

const {mutate, isPending} = useMutation({
  mutationKey: ['move-card'],
  mutationFn: ({docId, status}: { docId: string; status: EnumStatus }) => {
    if (import.meta.client && isGuestSession()) {
      return Promise.resolve({docId, status})
    }
    return updateCardStatus(docId, status)
  },
  onSuccess: (_, variables) => {
    if (import.meta.client && isGuestSession()) {
      boardStore.updateCardStatus(variables.docId, variables.status)
      queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
      queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
      emit('card-moved')
      return
    }
    queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
    emit('card-moved')
  },
})

const handleDragStart = (card: ICard, column: IColumn) => {
  emit('dragstart', card, column)
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (targetColumn: IColumn) => {
  isDragOver.value = false

  if (props.dragCard && props.sourceColumn && props.sourceColumn.id !== targetColumn.id) {
    mutate({
      docId: props.dragCard.id,
      status: targetColumn.id as EnumStatus
    })
  }
}

const handleDragEnd = () => {
  emit('dragend')
}

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
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop(column)"
  >
    <div class="column-header">
      <h2 class="column-title">{{ column.name }}</h2>
      <span class="column-count">{{ column.items.length }}</span>
    </div>

    <div class="column-content">
      <div v-if="isPending" class="loading-indicator">
        <div class="spinner-mini"></div>
        <span>Перемещение...</span>
      </div>

      <KanbanCard
          v-for="(card, index) in column.items"
          :key="card.id"
          :card="card"
          :column-id="column.id"
          :is-dragging="dragCard?.id === card.id"
          :style="{ animationDelay: `${index * 40}ms` }"
          @dragstart="handleDragStart(card, column)"
          @dragend="handleDragEnd"
      />

      <div v-if="column.items.length === 0 && !isPending" class="empty-column">
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

  &--over
    .column-content
      outline: 1px dashed var(--color-border-hover)
      outline-offset: 4px
      border-radius: var(--radius-md)

.column-header
  display: flex
  justify-content: space-between
  align-items: center
  margin-bottom: var(--spacing-2)
  padding: 0 2px

.column-title
  margin: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  color: var(--color-text)

.column-count
  font-size: var(--font-size-xs)
  font-weight: 500
  color: var(--color-text-muted)
  font-variant-numeric: tabular-nums

.column-content
  display: flex
  flex-direction: column

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
