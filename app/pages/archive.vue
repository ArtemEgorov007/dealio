<script setup lang="ts">
import {useQueryClient} from '@tanstack/vue-query'
import {useBoardStore} from '~~/store/board.store'
import {useAuthStore} from '~~/store/auth.store'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

useSeoMeta({ title: 'Архив | Dealio' })
dayjs.locale('ru')

const authStore = useAuthStore()
const boardStore = useBoardStore()
const queryClient = useQueryClient()

const isGuest = computed(() => authStore.isGuest)

onMounted(() => {
  if (import.meta.client && authStore.isGuest) {
    boardStore.init()
    boardStore.pruneExpired()
  }
})

const retentionDays = computed(() => boardStore.retentionDays)

const archivedCards = computed(() => boardStore.archivedCards)

const daysLeft = (archivedAt?: string): number => {
  if (!archivedAt) return retentionDays.value
  const elapsed = dayjs().diff(dayjs(archivedAt), 'day')
  return Math.max(0, retentionDays.value - elapsed)
}

const formatArchivedAt = (date?: string) =>
  date ? dayjs(date).format('D MMMM YYYY') : '—'

const CATEGORY_COLORS: Record<string, string> = {
  'Идея': 'badge--idea',
  'Задача': 'badge--task',
  'Wishlist': 'badge--wish',
}

const categoryClass = (name: string) => CATEGORY_COLORS[name] ?? ''

const PRIORITY_CLASS: Record<string, string> = {
  high: 'priority--high',
  medium: 'priority--medium',
  low: 'priority--low',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

const handleRestore = (id: string) => {
  boardStore.restoreCard(id)
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}

const handleDeletePermanently = (id: string) => {
  boardStore.deleteCardPermanently(id)
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}

const formatPrice = (price: number) =>
  price.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})
</script>

<template>
  <div class="archive-page">
    <header class="archive-header">
      <div class="archive-header__left">
        <h1 class="archive-title">Архив</h1>
        <span v-if="isGuest && archivedCards.length" class="archive-count">{{ archivedCards.length }}</span>
      </div>
      <p class="archive-subtitle">Удалённые карточки хранятся {{ retentionDays }} дней, затем удаляются автоматически</p>
    </header>

    <div v-if="!isGuest" class="archive-unavailable">
      <div class="unavailable-icon">
        <Icon name="heroicons:lock-closed" size="28"/>
      </div>
      <p class="unavailable-text">Архив доступен в демо-режиме</p>
    </div>

    <div v-else-if="archivedCards.length === 0" class="archive-empty">
      <div class="empty-icon-wrap">
        <Icon name="heroicons:archive-box" size="36"/>
      </div>
      <p class="empty-title">Архив пуст</p>
      <p class="empty-hint">Удалённые карточки появятся здесь. Их можно восстановить или удалить навсегда.</p>
    </div>

    <div v-else class="archive-list">
      <div
          v-for="card in archivedCards"
          :key="card.$id"
          class="archive-card"
          :class="`archive-card--priority-${card.priority}`"
      >
        <div class="archive-card__priority-bar" :class="`pbar--${card.priority}`"></div>

        <div class="archive-card__body">
          <div class="archive-card__top">
            <div class="archive-card__badges">
              <span class="category-badge" :class="categoryClass(card.customer?.name ?? '')">
                {{ card.customer?.name || '—' }}
              </span>
              <span class="priority-badge" :class="PRIORITY_CLASS[card.priority ?? 'medium']">
                <span class="priority-dot"></span>
                {{ PRIORITY_LABELS[card.priority ?? 'medium'] }}
              </span>
            </div>
            <div class="archive-card__countdown" :class="{ 'countdown--urgent': daysLeft(card.archivedAt) <= 3 }">
              <Icon name="heroicons:clock" size="12"/>
              <span v-if="daysLeft(card.archivedAt) === 0">Удаляется сегодня</span>
              <span v-else>{{ daysLeft(card.archivedAt) }} дн.</span>
            </div>
          </div>

          <div class="archive-card__name">{{ card.name }}</div>

          <div v-if="card.price > 0" class="archive-card__price">
            {{ formatPrice(card.price) }}
          </div>

          <div class="archive-card__meta">
            <span class="archive-card__date">
              <Icon name="heroicons:archive-box-arrow-down" size="11"/>
              Архивировано {{ formatArchivedAt(card.archivedAt) }}
            </span>
          </div>

          <div class="archive-card__actions">
            <button class="action-btn action-btn--restore" @click="handleRestore(card.$id)">
              <Icon name="heroicons:arrow-uturn-left" size="14"/>
              Восстановить
            </button>
            <button class="action-btn action-btn--delete" @click="handleDeletePermanently(card.$id)">
              <Icon name="heroicons:trash" size="14"/>
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.archive-page
  padding: var(--spacing-6)
  max-width: 900px
  margin: 0 auto

.archive-header
  margin-bottom: var(--spacing-6)

.archive-header__left
  display: flex
  align-items: center
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-1)

.archive-title
  font-size: var(--font-size-3xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  line-height: 1.1

.archive-count
  display: inline-flex
  align-items: center
  justify-content: center
  min-width: 26px
  height: 22px
  padding: 0 7px
  background-color: var(--color-bg-tertiary)
  color: var(--color-text-muted)
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: 700

.archive-subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  font-weight: 500

.archive-unavailable,
.archive-empty
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-3)
  padding: var(--spacing-12)
  text-align: center
  min-height: 300px

.unavailable-icon,
.empty-icon-wrap
  width: 64px
  height: 64px
  border-radius: var(--radius-xl)
  background-color: var(--color-bg-secondary)
  color: var(--color-text-muted)
  display: flex
  align-items: center
  justify-content: center

  .empty-icon-wrap
    opacity: 0.6

.unavailable-text,
.empty-title
  font-size: var(--font-size-base)
  font-weight: 600
  color: var(--color-text-secondary)

.empty-hint
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  max-width: 320px
  line-height: 1.5

.archive-list
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))
  gap: var(--spacing-4)

.archive-card
  position: relative
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-lg)
  overflow: hidden
  transition: box-shadow var(--transition-normal) ease
  opacity: 0
  animation: card-in 0.3s ease forwards

  &:hover
    box-shadow: var(--shadow-card-hover)

@keyframes card-in
  from
    opacity: 0
    transform: translateY(6px)
  to
    opacity: 1
    transform: translateY(0)

.archive-card__priority-bar
  position: absolute
  left: 0
  top: 0
  width: 3px
  height: 100%

  &.pbar--high
    background-color: var(--color-danger)

  &.pbar--medium
    background-color: var(--color-accent)

  &.pbar--low
    background-color: var(--color-text-muted)

.archive-card__body
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-4) calc(var(--spacing-4) + 3px)
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.archive-card__top
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-2)

.archive-card__badges
  display: flex
  align-items: center
  gap: var(--spacing-2)
  flex-wrap: wrap

.category-badge
  display: inline-flex
  align-items: center
  padding: 2px 7px
  border-radius: var(--radius-full)
  font-size: 10px
  font-weight: 700
  text-transform: uppercase
  letter-spacing: 0.4px

  &.badge--idea
    background-color: rgba(14, 165, 233, 0.1)
    color: var(--kanban-ideas-color)

  &.badge--task
    background-color: rgba(245, 158, 11, 0.1)
    color: var(--kanban-tasks-color)

  &.badge--wish
    background-color: rgba(236, 72, 153, 0.1)
    color: var(--kanban-wishlist-color)

.priority-badge
  display: inline-flex
  align-items: center
  gap: 4px
  padding: 2px 7px
  border-radius: var(--radius-full)
  font-size: 10px
  font-weight: 700

  &.priority--high
    background-color: rgba(239, 68, 68, 0.1)
    color: var(--color-danger)
    .priority-dot
      background-color: var(--color-danger)

  &.priority--medium
    background-color: rgba(245, 158, 11, 0.1)
    color: var(--color-accent)
    .priority-dot
      background-color: var(--color-accent)

  &.priority--low
    background-color: rgba(100, 116, 139, 0.1)
    color: var(--color-text-muted)
    .priority-dot
      background-color: var(--color-text-muted)

.priority-dot
  width: 5px
  height: 5px
  border-radius: 50%
  flex-shrink: 0

.archive-card__countdown
  display: flex
  align-items: center
  gap: 4px
  font-size: 11px
  font-weight: 600
  color: var(--color-text-muted)
  white-space: nowrap

  &.countdown--urgent
    color: var(--color-danger)

.archive-card__name
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  line-height: 1.35

.archive-card__price
  font-size: var(--font-size-sm)
  font-weight: 800
  color: var(--kanban-wishlist-color)
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"

.archive-card__meta
  display: flex
  align-items: center

.archive-card__date
  display: flex
  align-items: center
  gap: 4px
  font-size: 11px
  color: var(--color-text-muted)
  font-weight: 500

.archive-card__actions
  display: flex
  gap: var(--spacing-2)
  padding-top: var(--spacing-2)
  border-top: var(--border-width) solid var(--color-border)

.action-btn
  display: inline-flex
  align-items: center
  gap: var(--spacing-1)
  padding: 5px var(--spacing-3)
  border-radius: var(--radius-md)
  font-size: var(--font-size-xs)
  font-weight: 600
  cursor: pointer
  border: var(--border-width) solid transparent
  transition: all var(--transition-fast) ease

  &--restore
    background-color: var(--color-primary-light)
    color: var(--color-primary)
    border-color: var(--color-primary-muted)

    &:hover
      background-color: var(--color-primary)
      color: white

  &--delete
    background-color: var(--color-danger-light)
    color: var(--color-danger)
    border-color: rgba(239, 68, 68, 0.2)
    margin-left: auto

    &:hover
      background-color: var(--color-danger)
      color: white
</style>
