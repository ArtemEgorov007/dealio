<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import type { ICardRecord } from '~~/types/cards.types'
import { EnumStatus } from '~~/types/cards.types'
import { CARDS_STATS_QUERY_KEY, getCardsQueryScope } from '~/components/kanban/kanban.types'
import { useAuthStore } from '~~/store/auth.store'
import { useBoardStore } from '~~/store/board.store'
import { listCards } from '~/utils/appwrite-cards'

const authStore = useAuthStore()
const boardStore = useBoardStore()

const { data: cardsData, isLoading } = useQuery({
  queryKey: computed(() => [CARDS_STATS_QUERY_KEY, getCardsQueryScope(authStore.isGuest, authStore.userId)]),
  queryFn: async () => {
    if (import.meta.client && authStore.isGuest) {
      boardStore.init()
      return boardStore.activeCards
    }
    try {
      const response = await listCards()
      return response.documents as unknown as ICardRecord[]
    } catch {
      throw new Error('Не удалось загрузить статистику')
    }
  }
})

const stats = computed(() => {
  if (!cardsData.value) return null

  const cards = cardsData.value
  const total = cards.length
  const doing = cards.filter(c => c.status === EnumStatus.doing).length
  const done = cards.filter(c => c.status === EnumStatus.done).length
  const wishlistSum = cards
    .filter(c => c.status === EnumStatus.wishlist && c.price > 0)
    .reduce((acc, c) => acc + c.price, 0)

  return { total, doing, done, wishlistSum }
})

const formatSum = (sum: number) =>
  sum.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
</script>

<template>
  <div class="kanban-stats">
    <template v-if="isLoading">
      <div v-for="i in 4" :key="i" class="stat-card stat-card--skeleton"></div>
    </template>

    <template v-else-if="stats">
      <div class="stat-card">
        <div class="stat-icon stat-icon--slate">
          <Icon name="heroicons:rectangle-stack" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.total }}</div>
          <div class="stat-label">Всего</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--violet">
          <Icon name="heroicons:bolt" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.doing }}</div>
          <div class="stat-label">В работе</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--emerald">
          <Icon name="heroicons:check-badge" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.done }}</div>
          <div class="stat-label">Готово</div>
        </div>
      </div>

      <div class="stat-card stat-card--accent">
        <div class="stat-icon stat-icon--pink">
          <Icon name="heroicons:gift" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums stat-value--price">{{ formatSum(stats.wishlistSum) }}</div>
          <div class="stat-label">Wishlist ₽</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="sass">
.kanban-stats
  display: grid
  grid-template-columns: repeat(4, 1fr)
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-6)

  @media (max-width: 1100px)
    grid-template-columns: repeat(2, 1fr)

  @media (max-width: 600px)
    grid-template-columns: 1fr 1fr

.stat-card
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-lg)
  padding: var(--spacing-4) var(--spacing-5)
  display: flex
  align-items: center
  gap: var(--spacing-4)
  box-shadow: var(--shadow-xs)
  transition: all var(--transition-normal) ease

  &:hover
    box-shadow: var(--shadow-md)
    border-color: var(--color-border-hover)

  &--skeleton
    min-height: 76px
    background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%)
    background-size: 200% 100%
    animation: skeleton-shimmer 1.5s ease infinite
    border-color: transparent
    box-shadow: none

@keyframes skeleton-shimmer
  0%
    background-position: 200% 0
  100%
    background-position: -200% 0

.stat-icon
  width: 40px
  height: 40px
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

  &--slate
    background-color: rgba(100, 116, 139, 0.1)
    color: #64748b

  &--violet
    background-color: rgba(139, 92, 246, 0.1)
    color: #8b5cf6

  &--emerald
    background-color: rgba(16, 185, 129, 0.1)
    color: var(--color-success)

  &--pink
    background-color: rgba(236, 72, 153, 0.1)
    color: #ec4899

.stat-body
  min-width: 0
  flex: 1
  overflow: hidden

.stat-value
  font-size: var(--font-size-2xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  line-height: 1.1
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

  &--price
    font-size: var(--font-size-xl)

.stat-label
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  margin-top: 2px
</style>
