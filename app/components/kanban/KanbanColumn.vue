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
      <div class="column-header__left">
        <span class="column-dot" :class="`column-dot--${column.id}`"></span>
        <h2 class="column-title">{{ column.name }}</h2>
      </div>
      <span class="column-count">{{ column.items.length }}</span>
    </div>

    <CreateDeal :status="column.id" @deal-created="() => queryClient.invalidateQueries({queryKey: ['deals']})"/>

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
          :style="{ animationDelay: `${index * 40}ms` }"
          @dragstart="handleDragStart(card, column)"
          @dragend="handleDragEnd"
      />

      <div v-if="column.items.length === 0 && !isPending" class="empty-column">
        <Icon name="heroicons:inbox" size="20" class="empty-icon"/>
        <span>Нет сделок</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.kanban-column
  width: 288px
  flex-shrink: 0
  background-color: var(--color-bg-secondary)
  border-radius: var(--radius-xl)
  padding: var(--spacing-4)
  border: var(--border-width) solid var(--color-border)
  transition: all 0.2s ease
  display: flex
  flex-direction: column
  min-height: 400px

  &--over
    border-color: var(--color-primary)
    background-color: var(--color-primary-light)
    box-shadow: 0 0 0 2px var(--color-primary-muted)

.column-header
  display: flex
  justify-content: space-between
  align-items: center
  margin-bottom: var(--spacing-3)
  padding-bottom: var(--spacing-3)
  border-bottom: var(--border-width) solid var(--color-border)

.column-header__left
  display: flex
  align-items: center
  gap: var(--spacing-2)

.column-dot
  width: 8px
  height: 8px
  border-radius: 50%
  flex-shrink: 0

  &--todo
    background-color: var(--kanban-todo-color)

  &--to-be-agreed
    background-color: var(--kanban-agreed-color)

  &--in-progress
    background-color: var(--kanban-progress-color)

  &--produced
    background-color: var(--kanban-produced-color)

  &--done
    background-color: var(--kanban-done-color)

.column-title
  font-size: var(--font-size-sm)
  font-weight: 700
  color: var(--color-text)
  letter-spacing: -0.1px

.column-count
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-text-muted)
  background-color: var(--color-bg-tertiary)
  padding: 2px 7px
  border-radius: var(--radius-full)
  min-width: 22px
  text-align: center
  font-variant-numeric: tabular-nums

.column-content
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  flex: 1

.empty-column
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  flex: 1
  min-height: 120px
  border: 1.5px dashed var(--color-border)
  border-radius: var(--radius-lg)
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
