<script setup lang="ts">
import {useKanbanQuery} from '~/components/kanban/useKanbanQuery'
import {COLUMN_LABELS} from '~/components/kanban/kanban.labels'
import type {ICard} from '~/components/kanban/kanban.types'
import {EnumStatus} from '~~/types/cards.types'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {useAuthStore} from '~~/store/auth.store'
import {useQueryClient} from '@tanstack/vue-query'
import {useBoardStore} from '~~/store/board.store'
import {CARDS_QUERY_KEY} from '~/components/kanban/kanban.types'

dayjs.locale('ru')

const props = defineProps<{
  categoryFilter?: string
  title: string
  subtitle?: string
}>()

const {data, isLoading, isError} = useKanbanQuery()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const queryClient = useQueryClient()

const filteredCards = computed((): ICard[] => {
  if (!data.value) return []
  const allCards: ICard[] = data.value.flatMap(col => col.items)
  if (!props.categoryFilter) return allCards
  return allCards.filter(c => c.category === props.categoryFilter)
})

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
const CATEGORY_COLORS: Record<string, string> = {
  'Идея': 'badge--idea',
  'Задача': 'badge--task',
  'Wishlist': 'badge--wish',
}

const formatDate = (d: string) => dayjs(d).format('D MMM')
const formatPrice = (p: number) =>
  p.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})

const statusVariant: Record<string, string> = {
  ideas: 'info',
  tasks: 'warning',
  doing: 'primary',
  done: 'success',
  wishlist: 'secondary',
}

const handleArchive = (card: ICard) => {
  if (import.meta.client && authStore.isGuest) {
    boardStore.archiveCard(card.id)
    queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  }
}
</script>

<template>
  <div class="filtered-page">
    <header class="filtered-header">
      <h1 class="filtered-title">{{ title }}</h1>
      <p v-if="subtitle" class="filtered-subtitle">{{ subtitle }}</p>
    </header>

    <div v-if="isLoading" class="filtered-state">
      <div class="spinner-ring"></div>
    </div>

    <div v-else-if="isError" class="filtered-state">
      <p class="state-text">Ошибка загрузки данных</p>
    </div>

    <div v-else-if="filteredCards.length === 0" class="filtered-empty">
      <div class="empty-icon">
        <Icon name="heroicons:inbox" size="32"/>
      </div>
      <p class="empty-title">Пусто</p>
      <p class="empty-hint">Добавьте карточки на доску — они появятся здесь</p>
    </div>

    <div v-else class="filtered-grid">
      <div
          v-for="card in filteredCards"
          :key="card.id"
          class="fcard"
          :class="`fcard--p${card.priority}`"
      >
        <div class="fcard__pbar" :class="`pbar--${card.priority}`"></div>
        <div class="fcard__body">
          <div class="fcard__top">
            <div class="fcard__badges">
              <span class="cat-badge" :class="CATEGORY_COLORS[card.category]">{{ card.category }}</span>
              <span class="pri-badge" :class="PRIORITY_CLASS[card.priority]">
                <span class="pri-dot"></span>
                {{ PRIORITY_LABELS[card.priority] }}
              </span>
            </div>
            <button
                v-if="authStore.isGuest"
                class="fcard__archive"
                @click="handleArchive(card)"
                title="В архив"
            >
              <Icon name="heroicons:archive-box-arrow-down" size="13"/>
            </button>
          </div>

          <div class="fcard__name">{{ card.name }}</div>

          <div v-if="card.price > 0" class="fcard__price">{{ formatPrice(card.price) }}</div>

          <div class="fcard__meta">
            <UiBadge :variant="(statusVariant[card.status] as any) || 'secondary'" class="fcard__status">
              {{ COLUMN_LABELS[card.status as EnumStatus] || card.status }}
            </UiBadge>
            <span class="fcard__date">{{ formatDate(card.$createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.filtered-page
  padding: var(--spacing-6)
  max-width: 1100px
  margin: 0 auto

.filtered-header
  margin-bottom: var(--spacing-6)

.filtered-title
  font-size: var(--font-size-3xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  line-height: 1.1
  margin-bottom: var(--spacing-1)

.filtered-subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  font-weight: 500

.filtered-state
  display: flex
  align-items: center
  justify-content: center
  min-height: 300px

.spinner-ring
  width: 36px
  height: 36px
  border: 3px solid var(--color-border)
  border-top: 3px solid var(--color-primary)
  border-radius: 50%
  animation: spin 0.8s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)

.state-text
  color: var(--color-text-secondary)
  font-size: var(--font-size-base)

.filtered-empty
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-3)
  padding: var(--spacing-12)
  text-align: center
  min-height: 300px

.empty-icon
  width: 64px
  height: 64px
  border-radius: var(--radius-xl)
  background-color: var(--color-bg-secondary)
  display: flex
  align-items: center
  justify-content: center
  color: var(--color-text-muted)
  opacity: 0.6

.empty-title
  font-size: var(--font-size-base)
  font-weight: 600
  color: var(--color-text-secondary)

.empty-hint
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  max-width: 280px
  line-height: 1.5

.filtered-grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))
  gap: var(--spacing-4)

.fcard
  position: relative
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-lg)
  overflow: hidden
  transition: all var(--transition-normal) ease
  opacity: 0
  animation: card-in 0.3s ease forwards

  &:hover
    box-shadow: var(--shadow-card-hover)
    transform: translateY(-2px)
    border-color: var(--color-border-hover)

    .fcard__archive
      opacity: 1

@keyframes card-in
  from
    opacity: 0
    transform: translateY(8px)
  to
    opacity: 1
    transform: translateY(0)

.fcard__pbar
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

.fcard__body
  padding: var(--spacing-4) var(--spacing-4) var(--spacing-4) calc(var(--spacing-4) + 3px)
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.fcard__top
  display: flex
  align-items: center
  justify-content: space-between

.fcard__badges
  display: flex
  align-items: center
  gap: var(--spacing-2)
  flex-wrap: wrap

.cat-badge
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

.pri-badge
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
    .pri-dot
      background-color: var(--color-danger)

  &.priority--medium
    background-color: rgba(245, 158, 11, 0.1)
    color: var(--color-accent)
    .pri-dot
      background-color: var(--color-accent)

  &.priority--low
    background-color: rgba(100, 116, 139, 0.1)
    color: var(--color-text-muted)
    .pri-dot
      background-color: var(--color-text-muted)

.pri-dot
  width: 5px
  height: 5px
  border-radius: 50%
  flex-shrink: 0

.fcard__archive
  width: 24px
  height: 24px
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
  flex-shrink: 0

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-danger)

.fcard__name
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  line-height: 1.4

.fcard__price
  font-size: var(--font-size-sm)
  font-weight: 800
  color: var(--kanban-wishlist-color)
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"

.fcard__meta
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-2)

.fcard__status
  font-size: 10px

.fcard__date
  font-size: 11px
  color: var(--color-text-muted)
  font-weight: 500
</style>
