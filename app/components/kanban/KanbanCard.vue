<script setup lang="ts">
import type {ICard} from '~/components/kanban/kanban.types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {useCardSlideStore} from '~~/store/card-slide.store'

dayjs.locale('ru')

const props = defineProps<{
  card: ICard
  columnId: string
}>()

const emit = defineEmits<{
  (e: 'dragstart'): void
  (e: 'dragend'): void
}>()

const cardSlideStore = useCardSlideStore()

const handleDragStart = (event: DragEvent) => {
  event.dataTransfer?.setData('text/plain', props.card.id)
  event.dataTransfer!.effectAllowed = 'move'
  emit('dragstart')
}

const handleDragEnd = () => {
  emit('dragend')
}

const handleOpenSlideover = () => {
  cardSlideStore.set(props.card)
}

const formatDate = (dateString: string) => {
  const date = dayjs(dateString);
  const now = dayjs();
  const diffInDays = now.diff(date, 'day');

  if (diffInDays === 0) {
    return 'Сегодня';
  } else if (diffInDays === 1) {
    return 'Вчера';
  } else if (diffInDays < 7) {
    return `${diffInDays}д назад`;
  } else {
    return date.format('D MMM');
  }
}

const CATEGORY_ICONS: Record<string, string> = {
  'Идея': '💡',
  'Задача': '✅',
  'Wishlist': '🎁',
}

const categoryIcon = computed(() => CATEGORY_ICONS[props.card.category] ?? '')

const isWishlistItem = computed(() => props.card.price > 0)

const formatPrice = (price: number) =>
    price.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})
</script>

<template>
  <div
      class="kanban-card"
      :class="`kanban-card--${columnId}`"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @click="handleOpenSlideover"
      role="button"
      :aria-label="`Карточка: ${card.name}`"
      tabindex="0"
      @keydown.enter="handleOpenSlideover"
  >
    <div class="card-accent" :class="`card-accent--${columnId}`"></div>

    <div class="card-body">
      <div class="card-badge">
        <span class="card-badge__icon">{{ categoryIcon }}</span>
        <span class="card-badge__text">{{ card.category }}</span>
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
        <span class="drag-hint">
          <Icon name="heroicons:arrows-up-down" size="12"/>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.kanban-card
  position: relative
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-lg)
  cursor: grab
  transition: all var(--transition-normal) var(--transition-ease)
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

  &:active,
  &[draggable="true"]:active
    cursor: grabbing
    transform: translateY(-1px) scale(0.99)
    box-shadow: var(--shadow-lg)

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

.card-accent
  position: absolute
  top: 0
  left: 0
  width: 3px
  height: 100%

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

.card-body
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-3) calc(var(--spacing-4) + 3px)

.card-badge
  display: inline-flex
  align-items: center
  gap: 4px
  margin-bottom: 4px

.card-badge__icon
  font-size: 11px
  line-height: 1

.card-badge__text
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-primary)
  text-transform: uppercase
  letter-spacing: 0.5px

.card-name
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  line-height: 1.35
  margin-bottom: var(--spacing-3)

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
</style>
