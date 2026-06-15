<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import type { ICardRecord } from '~~/types/cards.types'
import { EnumStatus } from '~~/types/cards.types'
import { MOCK_CARDS } from '~/components/kanban/kanban.mock'
import { CARDS_STATS_QUERY_KEY, getCardsQueryScope } from '~/components/kanban/kanban.types'
import { useAuthStore } from '~~/store/auth.store'
import { listCards } from '~/utils/appwrite-cards'

const authStore = useAuthStore()

const { data: cardsData, isLoading } = useQuery({
  queryKey: computed(() => [CARDS_STATS_QUERY_KEY, getCardsQueryScope(authStore.isGuest)]),
  queryFn: async () => {
    if (import.meta.client && authStore.isGuest) {
      return MOCK_CARDS
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
  const totalCards = cards.length

  const statusCounts = {
    [EnumStatus.todo]: 0,
    [EnumStatus['to-be-agreed']]: 0,
    [EnumStatus['in-progress']]: 0,
    [EnumStatus.produced]: 0,
    [EnumStatus.done]: 0
  }

  cards.forEach(card => {
    if (card.status in statusCounts) {
      statusCounts[card.status as EnumStatus]++
    }
  })

  const inProgress = statusCounts[EnumStatus['in-progress']] + statusCounts[EnumStatus.produced]
  const completed = statusCounts[EnumStatus.done]
  const activeIdeas = statusCounts[EnumStatus.todo]

  const completionRate = totalCards > 0
    ? Math.round((completed / totalCards) * 100)
    : 0

  return {
    totalCards,
    inProgress,
    completed,
    activeIdeas,
    completionRate
  }
})
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
          <div class="stat-value tabular-nums">{{ stats.totalCards }}</div>
          <div class="stat-label">Всего карточек</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--amber">
          <Icon name="heroicons:light-bulb" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.activeIdeas }}</div>
          <div class="stat-label">Новые идеи</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--teal">
          <Icon name="heroicons:bolt" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.inProgress }}</div>
          <div class="stat-label">В процессе</div>
        </div>
      </div>

      <div class="stat-card stat-card--accent">
        <div class="stat-icon stat-icon--emerald">
          <Icon name="heroicons:check-badge" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">
            {{ stats.completed }}
            <span class="stat-sub">· {{ stats.completionRate }}%</span>
          </div>
          <div class="stat-label">Завершено</div>
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

  &--amber
    background-color: rgba(245, 158, 11, 0.1)
    color: var(--color-accent)

  &--teal
    background-color: var(--color-primary-light)
    color: var(--color-primary)

  &--emerald
    background-color: rgba(16, 185, 129, 0.1)
    color: var(--color-success)

.stat-body
  min-width: 0

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

.stat-sub
  font-size: var(--font-size-base)
  font-weight: 500
  color: var(--color-text-muted)

.stat-label
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  margin-top: 2px
</style>
