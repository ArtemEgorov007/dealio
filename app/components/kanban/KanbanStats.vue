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
  
  return {
    totalDeals,
    totalValue,
    statusCounts
  }
})
</script>

<template>
  <div class="kanban-stats">
    <div v-if="isLoading" class="stats-loading">
      <div class="spinner-small"></div>
      <span>Загрузка статистики...</span>
    </div>
    
    <div v-else-if="stats" class="stats-content">
      <div class="stat-item">
        <div class="stat-value">{{ stats.totalDeals }}</div>
        <div class="stat-label">Всего сделок</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-value">{{ stats.totalValue.toLocaleString('ru-RU') }} ₽</div>
        <div class="stat-label">Общая сумма</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-value">{{ stats.statusCounts[EnumStatus.done] }}</div>
        <div class="stat-label">Завершено</div>
      </div>
    </div>
    
    <div v-else class="stats-empty">
      <span>Нет данных</span>
    </div>
  </div>
</template>

<style scoped lang="sass">
.kanban-stats
  background-color: var(--color-card-bg)
  border-radius: var(--radius-lg)
  padding: var(--spacing-4)
  margin-bottom: var(--spacing-4)
  box-shadow: var(--shadow-sm)
  border: var(--border-width) solid var(--color-border)

.stats-loading,
.stats-empty
  display: flex
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  color: var(--color-text-secondary)
  min-height: 60px

.stats-content
  display: flex
  justify-content: space-around
  align-items: center

.stat-item
  text-align: center

.stat-value
  font-size: var(--font-size-xl)
  font-weight: var(--font-weight-bold)
  color: var(--color-primary)
  margin-bottom: var(--spacing-1)

.stat-label
  font-size: var(--font-size-xs)
  color: var(--color-text-secondary)
  text-transform: uppercase

.spinner-small
  width: 16px
  height: 16px
  border: 2px solid var(--color-border)
  border-top: 2px solid var(--color-primary)
  border-radius: 50%
  animation: spin 1s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)
</style>