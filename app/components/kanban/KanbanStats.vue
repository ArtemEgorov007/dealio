<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { COLLECTION_DEALS, DB_ID } from '~~/app.constants'
import type { IDeal } from '~~/types/deals.types'
import { EnumStatus } from '~~/types/deals.types'
import { MOCK_DEALS } from '~/components/kanban/kanban.mock'
import { isGuestSession } from '~~/store/auth.store'

const { data: dealsData, isLoading } = useQuery({
  queryKey: ['deals-stats'],
  queryFn: async () => {
    if (import.meta.client && isGuestSession()) {
      return MOCK_DEALS as IDeal[]
    }
    try {
      const response = await DB.listDocuments(DB_ID, COLLECTION_DEALS)
      return response.documents as unknown as IDeal[]
    } catch (error) {
      console.error('Error fetching deals for stats:', error)
      throw new Error('Не удалось загрузить статистику')
    }
  }
})

const stats = computed(() => {
  if (!dealsData.value) return null

  const deals = dealsData.value
  const totalDeals = deals.length
  const totalValue = deals.reduce((sum, deal) => sum + (deal.price || 0), 0)

  const statusCounts = {
    [EnumStatus.todo]: 0,
    [EnumStatus['to-be-agreed']]: 0,
    [EnumStatus['in-progress']]: 0,
    [EnumStatus.produced]: 0,
    [EnumStatus.done]: 0
  }

  deals.forEach(deal => {
    if (deal.status in statusCounts) {
      statusCounts[deal.status as EnumStatus]++
    }
  })

  const conversionRate = totalDeals > 0
    ? Math.round((statusCounts[EnumStatus.done] / totalDeals) * 100)
    : 0

  return {
    totalDeals,
    totalValue,
    statusCounts,
    conversionRate
  }
})
</script>

<template>
  <div class="kanban-stats">
    <template v-if="isLoading">
      <div v-for="i in 3" :key="i" class="stat-card stat-card--skeleton"></div>
    </template>

    <template v-else-if="stats">
      <div class="stat-card">
        <div class="stat-icon stat-icon--slate">
          <Icon name="heroicons:rectangle-stack" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.totalDeals }}</div>
          <div class="stat-label">Всего сделок</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--teal">
          <Icon name="heroicons:currency-dollar" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.totalValue.toLocaleString('ru-RU') }} <span class="stat-unit">₽</span></div>
          <div class="stat-label">Общая сумма</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--emerald">
          <Icon name="heroicons:check-badge" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">
            {{ stats.statusCounts[EnumStatus.done] }}
            <span class="stat-sub">/ {{ stats.totalDeals }}</span>
          </div>
          <div class="stat-label">Завершено</div>
        </div>
      </div>

      <div class="stat-card stat-card--accent">
        <div class="stat-icon stat-icon--violet">
          <Icon name="heroicons:arrow-trending-up" size="18"/>
        </div>
        <div class="stat-body">
          <div class="stat-value tabular-nums">{{ stats.conversionRate }}<span class="stat-unit">%</span></div>
          <div class="stat-label">Конверсия</div>
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

  &--teal
    background-color: var(--color-primary-light)
    color: var(--color-primary)

  &--emerald
    background-color: rgba(16, 185, 129, 0.1)
    color: var(--color-success)

  &--violet
    background-color: rgba(139, 92, 246, 0.1)
    color: #8b5cf6

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

.stat-unit
  font-size: var(--font-size-base)
  font-weight: 600
  color: var(--color-text-secondary)
  letter-spacing: -0.2px

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
