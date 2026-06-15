<script setup lang="ts">
import type {ICard} from '~/components/kanban/kanban.types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {useDealSlideStore} from '~~/store/deal-slide.store'

dayjs.locale('ru')

const props = defineProps<{
  card: ICard
  columnId: string
}>()

const emit = defineEmits<{
  (e: 'dragstart'): void
  (e: 'dragend'): void
}>()

const dealSlideStore = useDealSlideStore()

const handleDragStart = (event: DragEvent) => {
  event.dataTransfer?.setData('text/plain', props.card.id)
  event.dataTransfer!.effectAllowed = 'move'
  emit('dragstart')
}

const handleDragEnd = () => {
  emit('dragend')
}

const handleOpenSlideover = () => {
  dealSlideStore.set(props.card)
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

const formatPrice = (price?: number) => {
  if (!price) return '—'
  return price.toLocaleString('ru-RU')
}
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
      :aria-label="`Сделка: ${card.name}`"
      tabindex="0"
      @keydown.enter="handleOpenSlideover"
  >
    <div class="card-accent" :class="`card-accent--${columnId}`"></div>

    <div class="card-body">
      <div class="card-company">{{ card.companyName }}</div>
      <div class="card-name">{{ card.name }}</div>

      <div class="card-price-row">
        <span class="card-price tabular-nums">{{ formatPrice(card.price) }} <span class="card-currency">₽</span></span>
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

.card-body
  padding: var(--spacing-3) var(--spacing-4) var(--spacing-3) calc(var(--spacing-4) + 3px)

.card-company
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 0.5px
  margin-bottom: 3px

.card-name
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  line-height: 1.35
  margin-bottom: var(--spacing-3)

.card-price-row
  margin-bottom: var(--spacing-3)

.card-price
  font-size: var(--font-size-xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"
  line-height: 1

.card-currency
  font-size: var(--font-size-base)
  font-weight: 600
  color: var(--color-text-secondary)

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
