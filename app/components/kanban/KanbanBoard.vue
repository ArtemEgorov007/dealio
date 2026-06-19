<script setup lang="ts">
import {computed, provide, ref} from 'vue'
import {useQueryClient} from '@tanstack/vue-query'

import {useKanbanQuery} from '~/components/kanban/useKanbanQuery'
import type {ICard} from '~/components/kanban/kanban.types'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {KANBAN_DRAG_KEY} from '~/components/kanban/kanban-drag-context'
import {
    createDragGhost,
    KANBAN_DRAG_THRESHOLD_PX,
    moveDragGhost,
    removeDragGhost,
    resolveDropColumnId,
} from '~/components/kanban/kanban-pointer-drag'
import {useMoveCard} from '~/components/kanban/useMoveCard'
import {useAuthStore} from '~~/store/auth.store'
import type {EnumStatus} from '~~/types/cards.types'

const authStore = useAuthStore()
const queryClient = useQueryClient()

const dragCardRef = ref<ICard | null>(null)
const sourceColumnIdRef = ref<string | null>(null)
const dropTargetColumnIdRef = ref<string | null>(null)
const wasDraggingRef = ref(false)

const {data, isLoading, isError, error} = useKanbanQuery()

const invalidateBoard = () => {
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}

const {moveCard, isMoving, movingToStatus} = useMoveCard(invalidateBoard)

const movingToColumnId = computed(() =>
    isMoving.value ? movingToStatus.value?.status : null,
)

let pendingPointerId: number | null = null
let pendingCard: ICard | null = null
let pendingColumnId: string | null = null
let pendingElement: HTMLElement | null = null
let pendingStartX = 0
let pendingStartY = 0

let ghostElement: HTMLElement | null = null
let ghostOffsetX = 0
let ghostOffsetY = 0

const clearPointerSession = () => {
  pendingPointerId = null
  pendingCard = null
  pendingColumnId = null
  pendingElement = null
}

const endDrag = () => {
  removeDragGhost(ghostElement)
  ghostElement = null

  dragCardRef.value = null
  sourceColumnIdRef.value = null
  dropTargetColumnIdRef.value = null

  if (import.meta.client) {
    document.body.classList.remove('dealio-kanban-dragging')
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.removeEventListener('pointercancel', handlePointerUp)
  }
}

const startActiveDrag = (event: PointerEvent) => {
  if (!pendingCard || !pendingColumnId || !pendingElement) return

  wasDraggingRef.value = true
  dragCardRef.value = pendingCard
  sourceColumnIdRef.value = pendingColumnId

  const ghost = createDragGhost(pendingElement, event.clientX, event.clientY)
  ghostElement = ghost.ghost
  ghostOffsetX = ghost.offsetX
  ghostOffsetY = ghost.offsetY

  document.body.classList.add('dealio-kanban-dragging')
  clearPointerSession()
}

const handlePointerMove = (event: PointerEvent) => {
  if (pendingCard && pendingPointerId === event.pointerId) {
    const dx = event.clientX - pendingStartX
    const dy = event.clientY - pendingStartY

    if (Math.hypot(dx, dy) < KANBAN_DRAG_THRESHOLD_PX) {
      return
    }

    startActiveDrag(event)
  }

  if (!dragCardRef.value || !ghostElement) {
    return
  }

  event.preventDefault()
  moveDragGhost(ghostElement, event.clientX, event.clientY, ghostOffsetX, ghostOffsetY)

  const columnId = resolveDropColumnId(event.clientX, event.clientY)
  dropTargetColumnIdRef.value =
      columnId && columnId !== sourceColumnIdRef.value ? columnId : null
}

const releasePointerCapture = (event: PointerEvent) => {
  if (pendingElement?.hasPointerCapture(event.pointerId)) {
    pendingElement.releasePointerCapture(event.pointerId)
  }
}

const handlePointerUp = (event: PointerEvent) => {
  releasePointerCapture(event)

  if (pendingPointerId === event.pointerId) {
    clearPointerSession()
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    document.removeEventListener('pointercancel', handlePointerUp)
    return
  }

  if (!dragCardRef.value || !sourceColumnIdRef.value) {
    endDrag()
    return
  }

  const targetColumnId = dropTargetColumnIdRef.value

  if (targetColumnId) {
    moveCard({
      docId: dragCardRef.value.id,
      status: targetColumnId as EnumStatus,
    })
  }

  endDrag()

  setTimeout(() => {
    wasDraggingRef.value = false
  }, 50)
}

const onCardPointerDown = (event: PointerEvent, card: ICard, columnId: string) => {
  if (event.button !== 0) return
  if ((event.target as HTMLElement).closest('.card-archive-btn')) return
  if (dragCardRef.value || pendingCard) return

  wasDraggingRef.value = false
  pendingPointerId = event.pointerId
  pendingCard = card
  pendingColumnId = columnId
  pendingElement = event.currentTarget as HTMLElement
  pendingStartX = event.clientX
  pendingStartY = event.clientY

  pendingElement.setPointerCapture(event.pointerId)

  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp)
  document.addEventListener('pointercancel', handlePointerUp)
}

provide(KANBAN_DRAG_KEY, {
  dragCard: dragCardRef,
  dropTargetColumnId: dropTargetColumnIdRef,
  movingToColumnId,
  onCardPointerDown,
  wasDragging: wasDraggingRef,
})
</script>

<template>
  <div class="kanban-page">
    <div class="kanban-page__head">
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
    </div>

    <div class="kanban-surface">
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
  </div>
</template>

<style scoped lang="sass">
.kanban-page
  display: flex
  flex-direction: column
  flex: 1
  min-height: 0

.kanban-page__head
  flex-shrink: 0
  padding: var(--spacing-6) var(--spacing-6) var(--spacing-4)

  @media (max-width: 768px)
    padding: var(--spacing-4) var(--spacing-4) var(--spacing-3)

.kanban-surface
  flex: 1
  display: flex
  flex-direction: column
  min-height: 0
  width: 100%
  background-color: var(--kanban-surface-bg)
  background-image: var(--kanban-grid-pattern)
  background-size: var(--kanban-grid-size)
  background-position: 0 0
  border-top: var(--border-width) solid var(--color-border)

.kanban-header
  margin-bottom: var(--spacing-4)

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
  background-color: rgba(255, 154, 68, 0.1)
  color: #ff9a44
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: 700
  letter-spacing: 0.3px
  border: 1px solid rgba(255, 154, 68, 0.2)

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
  flex: 1
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
  position: relative
  flex: 1
  min-height: 0
  overflow: auto
  padding: var(--spacing-4)

  &::-webkit-scrollbar
    height: 6px

  &::-webkit-scrollbar-track
    background: transparent

  &::-webkit-scrollbar-thumb
    background: var(--color-border-hover)
    border-radius: var(--radius-full)

.kanban-board
  position: relative
  z-index: 1
  display: flex
  align-items: flex-start
  gap: var(--spacing-4)
  min-width: max-content
  min-height: min-content
</style>
