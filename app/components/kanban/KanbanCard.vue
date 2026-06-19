<script setup lang="ts">
import type {ICard} from '~/components/kanban/kanban.types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {inject} from 'vue'
import {useCardSlideStore} from '~~/store/card-slide.store'
import {useArchiveCard} from '~/components/kanban/useArchiveCard'
import {KANBAN_DRAG_KEY} from '~/components/kanban/kanban-drag-context'
import {isWishlistCategory} from '~/utils/card-priority'

dayjs.locale('ru')

const props = defineProps<{
  card: ICard
  columnId: string
  isDragging?: boolean
}>()

const kanbanDrag = inject(KANBAN_DRAG_KEY)
if (!kanbanDrag) {
  throw new Error('KanbanCard must be used inside KanbanBoard')
}

const cardSlideStore = useCardSlideStore()
const {mutate: archiveCard, isPending: isArchiving} = useArchiveCard()

const isEntered = ref(false)

const handleEnterAnimationEnd = (event: AnimationEvent) => {
  if (event.animationName.includes('card-in')) {
    isEntered.value = true
  }
}

const handlePointerDown = (event: PointerEvent) => {
  kanbanDrag.onCardPointerDown(event, props.card, props.columnId)
}

const handleOpenSlideover = () => {
  if (kanbanDrag.wasDragging.value) return
  cardSlideStore.set(props.card)
}

const handleArchive = (event: MouseEvent) => {
  event.stopPropagation()
  if (isArchiving.value) return
  archiveCard(props.card)
}

const isWishlistItem = computed(() => isWishlistCategory(props.card.category) && props.card.price > 0)

const formatPrice = (price: number) =>
    price.toLocaleString('ru-RU', {maximumFractionDigits: 0})
</script>

<template>
  <div
      class="kanban-card"
      :class="[
        `kanban-card--${columnId}`,
        { 'kanban-card--dragging': isDragging, 'kanban-card--enter': !isEntered },
      ]"
      @pointerdown="handlePointerDown"
      @animationend="handleEnterAnimationEnd"
      @click="handleOpenSlideover"
      role="button"
      :aria-label="`Карточка: ${card.name}`"
      tabindex="0"
      @keydown.enter="handleOpenSlideover"
  >
    <span class="card-name">{{ card.name }}</span>

    <div class="card-right">
      <span v-if="isWishlistItem" class="card-price tabular-nums">{{ formatPrice(card.price) }}</span>
      <span v-else class="card-dot" :class="`card-dot--${columnId}`"></span>

      <button
          class="card-archive-btn"
          :disabled="isArchiving"
          @click.stop="handleArchive"
          aria-label="В архив"
          title="В архив"
      >
        <Icon name="heroicons:archive-box-arrow-down" size="13"/>
      </button>
    </div>
  </div>
</template>

<style scoped lang="sass">
.kanban-card
  position: relative
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  width: 100%
  max-width: 100%
  min-width: 0
  overflow: hidden
  background-color: var(--kanban-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-bottom: none
  padding: 11px 12px
  cursor: pointer
  transition: background-color var(--transition-fast) ease, opacity var(--transition-normal) var(--transition-ease), transform var(--transition-normal) var(--transition-ease), box-shadow var(--transition-normal) var(--transition-ease)
  user-select: none
  touch-action: pan-x pan-y

  &:first-child
    border-radius: var(--radius-md) var(--radius-md) 0 0

  &:last-child
    border-bottom: var(--border-width) solid var(--color-card-border)
    border-radius: 0 0 var(--radius-md) var(--radius-md)

  &--enter
    opacity: 0
    animation: card-in 0.2s ease forwards

  &:hover
    background-color: var(--color-bg-tertiary)

    .card-archive-btn
      opacity: 1

  &--dragging
    opacity: 0.4
    transform: scale(0.98)
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28)

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: -2px

@keyframes card-in
  from
    opacity: 0
  to
    opacity: 1

.card-name
  flex: 1 1 auto
  font-size: var(--font-size-sm)
  font-weight: 500
  color: var(--color-text)
  min-width: 0
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.card-right
  display: flex
  align-items: center
  gap: var(--spacing-2)
  flex-shrink: 0
  min-width: 0

.card-price
  max-width: 72px
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-secondary)
  font-family: var(--font-numeric)
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  flex-shrink: 0

.card-dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0
  background-color: var(--color-text-muted)

  &--ideas
    background-color: var(--kanban-ideas-color)

  &--tasks
    background-color: var(--kanban-tasks-color)

  &--doing
    background-color: var(--kanban-doing-color)

  &--done
    background-color: var(--kanban-done-tracker-color)

  &--wishlist
    background-color: var(--kanban-wishlist-color)

.card-archive-btn
  width: 20px
  height: 20px
  display: flex
  align-items: center
  justify-content: center
  background: none
  border: none
  border-radius: var(--radius-sm)
  color: var(--color-text-muted)
  cursor: pointer
  opacity: 0
  transition: all var(--transition-fast) ease
  padding: 0

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-danger)
</style>
