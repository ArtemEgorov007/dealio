<script setup lang="ts">
import type {IColumn, ICard} from '~/components/kanban/kanban.types'
import type {EnumStatus, IDeal} from '~~/types/deals.types'

import {ref} from 'vue'
import {useMutation, useQueryClient} from '@tanstack/vue-query'

import CreateDeal from '~/components/kanban/CreateDeal.vue'
import {COLLECTION_DEALS, DB_ID} from '~~/app.constants'
import {isGuestSession} from '~~/store/auth.store'

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

const {mutate, isPending} = useMutation({
  mutationKey: ['move-card'],
  mutationFn: ({docId, status}: { docId: string; status: EnumStatus }) => {
    if (import.meta.client && isGuestSession()) {
      return Promise.resolve({docId, status})
    }
    return DB.updateDocument(DB_ID, COLLECTION_DEALS, docId, {status})
  },
  onSuccess: (_, variables) => {
    if (import.meta.client && isGuestSession()) {
      queryClient.setQueryData(['deals'], (old: { documents: IDeal[]; total: number } | undefined) => {
        if (!old) return old
        const updated = old.documents.map(d =>
          d.$id === variables.docId ? { ...d, status: variables.status } : d
        )
        return { ...old, documents: updated }
      })
      queryClient.setQueryData(['deals-stats'], (old: IDeal[] | undefined) => {
        if (!old) return old
        return old.map(d => d.$id === variables.docId ? { ...d, status: variables.status } : d)
      })
      emit('card-moved')
      return
    }
    queryClient.invalidateQueries({queryKey: ['deals']})
    emit('card-moved')
  },
  onError: (error) => {
    console.error('Error moving card:', error)
  }
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
      <h2 class="column-title">
        {{ column.name }}
      </h2>
      <span class="column-count">({{ column.items.length }})</span>
    </div>

    <CreateDeal :status="column.id" @deal-created="() => queryClient.invalidateQueries({queryKey: ['deals']})"/>

    <div class="column-content">
      <div v-if="isPending" class="loading-indicator">
        <div class="spinner-small"></div>
        Перемещение...
      </div>
      
      <KanbanCard
          v-for="card in column.items"
          :key="card.id"
          :card="card"
          :column-id="column.id"
          @dragstart="handleDragStart(card, column)"
          @dragend="handleDragEnd"
      />

      <p v-if="column.items.length === 0 && !isPending" class="empty-column">Нет сделок</p>
    </div>
  </div>
</template>

<style scoped lang="sass">
.kanban-column
  flex: 1
  min-width: 280px
  background-color: var(--color-bg-secondary)
  border-radius: var(--radius-lg)
  padding: var(--spacing-4)
  border: var(--border-width) solid var(--color-border)
  transition: all 0.2s ease
  display: flex
  flex-direction: column

  &--todo
    border-top: 3px solid var(--color-warning)

  &--to-be-agreed
    border-top: 3px solid #f97316

  &--in-progress
    border-top: 3px solid var(--color-primary)

  &--produced
    border-top: 3px solid #9333ea

  &--done
    border-top: 3px solid var(--color-success)

  &--over
    background-color: rgba(59, 130, 246, 0.08)
    box-shadow: 0 0 0 2px var(--color-primary)
    transform: scale(1.02)

.column-header
  display: flex
  justify-content: space-between
  align-items: center
  margin-bottom: var(--spacing-3)

.column-title
  font-size: var(--font-size-lg)
  font-weight: var(--font-weight-semibold)
  color: var(--color-text)

.column-count
  font-size: var(--font-size-sm)
  color: var(--color-text-tertiary)
  background-color: var(--color-bg)
  padding: var(--spacing-1) var(--spacing-2)
  border-radius: var(--radius-full)
  min-width: 24px
  text-align: center

.column-content
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
  flex: 1

.empty-column
  text-align: center
  font-style: italic
  color: var(--color-text-tertiary)
  padding: var(--spacing-4)
  border: 1px dashed var(--color-border)
  border-radius: var(--radius-md)
  flex: 1
  display: flex
  align-items: center
  justify-content: center

.loading-indicator
  display: flex
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  padding: var(--spacing-2)
  color: var(--color-text-secondary)
  font-size: var(--font-size-sm)

.spinner-small
  width: 16px
  height: 16px
  border: 2px solid var(--color-border)
  border-top: 2px solid var(--color-primary)
  border-radius: 50%
  animation: spin 1s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)
</style>