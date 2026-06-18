<script setup lang="ts">
import {useQuery} from '@tanstack/vue-query'

import {CARDS_STATS_QUERY_KEY, getCardsQueryScope} from '~/components/kanban/kanban.types'
import {fromAppwritePrice} from '~/utils/card-priority'
import {fromAppwriteStatus} from '~/utils/appwrite-status'
import type {ICardRecord} from '~~/types/cards.types'
import {EnumStatus} from '~~/types/cards.types'
import {useAuthStore} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {listCards} from '~/utils/appwrite-cards'

interface StatTile {
  id: string
  label: string
  value: string
}

const authStore = useAuthStore()
const boardStore = useBoardStore()

const {data: cardsData, isLoading} = useQuery({
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
  },
})

const stats = computed(() => {
  if (!cardsData.value) return null

  const normalized = cardsData.value.map(card => {
    const category = card.customer?.name ?? ''
    const uiStatus = authStore.isGuest
        ? (card.status as EnumStatus)
        : fromAppwriteStatus(String(card.status))

    return {
      uiStatus,
      uiPrice: authStore.isGuest ? card.price : fromAppwritePrice(card.price, category),
      category,
    }
  })

  const total = normalized.length
  const doing = normalized.filter(c => c.uiStatus === EnumStatus.doing).length
  const done = normalized.filter(c => c.uiStatus === EnumStatus.done).length
  const wishlistSum = normalized
      .filter(c => c.uiStatus === EnumStatus.wishlist && c.uiPrice > 0)
      .reduce((acc, c) => acc + c.uiPrice, 0)

  const donePercent = total > 0 ? Math.round((done / total) * 100) : 0
  const doingPercent = total > 0 ? Math.round((doing / total) * 100) : 0

  return {total, doing, done, wishlistSum, donePercent, doingPercent}
})

const formatSum = (sum: number) =>
    sum.toLocaleString('ru-RU', {maximumFractionDigits: 0})

const statTiles = computed((): StatTile[] => {
  if (!stats.value) return []

  return [
    {id: 'total', label: 'всего', value: String(stats.value.total)},
    {id: 'doing', label: 'в работе', value: String(stats.value.doing)},
    {id: 'done', label: 'готово', value: String(stats.value.done)},
    {id: 'wishlist', label: 'wishlist', value: formatSum(stats.value.wishlistSum)},
  ]
})
</script>

<template>
  <div v-if="isLoading" class="stats-chips">
    <span v-for="i in 4" :key="i" class="chip chip--skeleton"></span>
  </div>

  <div v-else-if="stats" class="stats-chips">
    <span
        v-for="tile in statTiles"
        :key="tile.id"
        class="chip"
        :class="`chip--${tile.id}`"
    >
      <span class="chip__dot" :class="`chip__dot--${tile.id}`"></span>
      <strong class="chip__value tabular-nums">{{ tile.value }}</strong>
      {{ tile.label }}
    </span>
  </div>
</template>

<style scoped lang="sass">
.stats-chips
  display: flex
  flex-wrap: wrap
  gap: var(--spacing-2)
  margin-bottom: var(--spacing-5)

.chip
  display: inline-flex
  align-items: center
  gap: 6px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-full)
  padding: 5px 12px
  font-size: var(--font-size-xs)
  color: var(--color-text-secondary)

  &--skeleton
    width: 90px
    height: 26px
    background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%)
    background-size: 200% 100%
    animation: skeleton-shimmer 1.5s ease infinite
    border-color: transparent

@keyframes skeleton-shimmer
  0%
    background-position: 200% 0
  100%
    background-position: -200% 0

.chip__dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0
  background-color: var(--color-text-muted)

  &--doing
    background-color: var(--kanban-doing-color)

  &--done
    background-color: var(--kanban-done-tracker-color)

  &--wishlist
    background-color: var(--kanban-wishlist-color)

.chip__value
  color: var(--color-text)
  font-weight: 600
  font-family: var(--font-numeric)
</style>
