<script setup lang="ts">
import type {ICard} from '~/components/kanban/kanban.types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {useCardSlideStore} from '~~/store/card-slide.store'
import {useAuthStore} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {useQueryClient} from '@tanstack/vue-query'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'

dayjs.locale('ru')

const props = defineProps<{
  card: ICard
  columnId: string
  isDragging?: boolean
}>()

const emit = defineEmits<{
  (e: 'dragstart'): void
  (e: 'dragend'): void
}>()

const cardSlideStore = useCardSlideStore()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const queryClient = useQueryClient()

const skipClick = ref(false)

const handleDragStart = (event: DragEvent) => {
  event.dataTransfer?.setData('text/plain', props.card.id)
  event.dataTransfer!.effectAllowed = 'move'
  skipClick.value = true
  emit('dragstart')
}

const handleDragEnd = () => {
  emit('dragend')
  requestAnimationFrame(() => {
    setTimeout(() => {
      skipClick.value = false
    }, 50)
  })
}

const handleOpenSlideover = () => {
  if (skipClick.value) return
  cardSlideStore.set(props.card)
}

const handleArchive = (event: MouseEvent) => {
  event.stopPropagation()
  if (import.meta.client && authStore.isGuest) {
    boardStore.archiveCard(props.card.id)
    queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
    queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
  }
}

const formatDate = (dateString: string) => {
  const date = dayjs(dateString)
  const now = dayjs()
  const diffInDays = now.diff(date, 'day')

  if (diffInDays === 0) return 'Сегодня'
  if (diffInDays === 1) return 'Вчера'
  if (diffInDays < 7) return `${diffInDays}д назад`
  return date.format('D MMM')
}

const CATEGORY_COLORS: Record<string, string> = {
  'Идея': 'category--idea',
  'Задача': 'category--task',
  'Wishlist': 'category--wish',
}

const categoryClass = computed(() => CATEGORY_COLORS[props.card.category] ?? '')
const isWishlistItem = computed(() => props.card.price > 0)
const isGuest = computed(() => authStore.isGuest)

const formatPrice = (price: number) =>
    price.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})
</script>

<template>
  <div
      class="kanban-card"
      :class="[
        `kanban-card--${columnId}`,
        `kanban-card--priority-${card.priority}`,
        { 'kanban-card--dragging': isDragging },
      ]"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @click="handleOpenSlideover"
      role="button"
      :aria-label="`Карточка: ${card.name}`"
      tabindex="0"
      @keydown.enter="handleOpenSlideover"
  >
    <div class="card-priority-bar" :class="`priority-bar--${card.priority}`"></div>

    <div class="card-body">
      <div class="card-top-row">
        <span class="card-badge" :class="categoryClass">{{ card.category }}</span>
        <div class="card-actions">
          <span class="priority-pill" :class="`priority-pill--${card.priority}`">
            <span class="priority-dot"></span>
          </span>
          <button
              v-if="isGuest"
              class="card-archive-btn"
              @click.stop="handleArchive"
              aria-label="В архив"
              title="В архив"
          >
            <Icon name="heroicons:archive-box-arrow-down" size="13"/>
          </button>
        </div>
      </div>

      <div class="card-name">{{ card.name }}</div>

      <div v-if="isWishlistItem" class="card-price tabular-nums">
        {{ formatPrice(card.price) }}
      </div>

      <div class="card-meta">
        <span class="card-date">
          <Icon name="heroicons:clock" size="11" class="meta-icon"/>
          {{ formatDate(card.$createdAt) }}
        </span>
        <span class="drag-hint" aria-hidden="true">
          <Icon name="heroicons:arrows-up-down" size="12"/>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.kanban-card
  position: relative
  min-width: 0
  max-width: 100%
  background-color: var(--kanban-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-lg)
  box-shadow: var(--shadow-sm)
  cursor: pointer
  transition: box-shadow var(--transition-normal) var(--transition-ease), transform var(--transition-normal) var(--transition-ease), border-color var(--transition-normal) ease
  user-select: none
  overflow: hidden
  opacity: 0
  animation: card-in 0.3s ease forwards

  &:hover
    box-shadow: var(--shadow-card-hover)
    transform: translateY(-3px)
    border-color: var(--color-border-hover)

    .drag-hint
      opacity: 1

    .card-archive-btn
      opacity: 1

  &--dragging
    cursor: grabbing
    transform: translateY(-1px) scale(0.99)
    box-shadow: var(--shadow-lg)
    opacity: 0.85

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

@keyframes card-in
  from
    opacity: 0
    transform: translateY(8px)
  to
    opacity: 1
    transform: translateY(0)

.card-priority-bar
  position: absolute
  top: 0
  left: 0
  width: 3px
  height: 100%

  &--high
    background-color: var(--color-danger)

  &--medium
    background-color: var(--color-accent)

  &--low
    background-color: var(--color-text-muted)

.card-body
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-3) calc(var(--spacing-4) + 3px)
  min-width: 0

.card-top-row
  display: flex
  align-items: flex-start
  justify-content: space-between
  margin-bottom: 6px
  gap: var(--spacing-2)
  min-width: 0

.card-actions
  display: flex
  align-items: center
  gap: var(--spacing-1)
  flex-shrink: 0

.card-badge
  display: inline-flex
  align-items: center
  padding: 2px 7px
  border-radius: var(--radius-full)
  font-size: 10px
  font-weight: 700
  text-transform: uppercase
  letter-spacing: 0.4px
  max-width: calc(100% - 48px)
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  flex-shrink: 1
  min-width: 0

  &.category--idea
    background-color: rgba(14, 165, 233, 0.1)
    color: var(--kanban-ideas-color)

  &.category--task
    background-color: rgba(245, 158, 11, 0.1)
    color: var(--kanban-tasks-color)

  &.category--wish
    background-color: rgba(236, 72, 153, 0.1)
    color: var(--kanban-wishlist-color)

.priority-pill
  display: inline-flex
  align-items: center
  justify-content: center
  width: 16px
  height: 16px
  border-radius: var(--radius-full)

  &--high
    background-color: rgba(239, 68, 68, 0.12)
    .priority-dot
      background-color: var(--color-danger)

  &--medium
    background-color: rgba(245, 158, 11, 0.12)
    .priority-dot
      background-color: var(--color-accent)

  &--low
    background-color: rgba(100, 116, 139, 0.12)
    .priority-dot
      background-color: var(--color-text-muted)

.priority-dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0

.card-archive-btn
  width: 22px
  height: 22px
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

.card-name
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  line-height: 1.4
  margin-bottom: var(--spacing-3)
  overflow-wrap: anywhere
  word-break: break-word
  hyphens: auto

.card-price
  font-size: var(--font-size-sm)
  font-weight: 800
  color: var(--kanban-wishlist-color)
  margin-bottom: var(--spacing-2)
  letter-spacing: -0.3px
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"

.card-meta
  display: flex
  align-items: center
  justify-content: space-between

.card-date
  display: flex
  align-items: center
  gap: 4px
  font-size: 11px
  color: var(--color-text-muted)
  font-weight: 500

.meta-icon
  opacity: 0.6

.drag-hint
  color: var(--color-text-muted)
  opacity: 0
  transition: opacity var(--transition-fast) ease
  display: flex
  align-items: center
  cursor: grab
</style>
