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
  hint: string
  icon: string
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
    sum.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 0})

const statTiles = computed((): StatTile[] => {
  if (!stats.value) return []

  return [
    {
      id: 'total',
      label: 'Всего',
      value: String(stats.value.total),
      hint: 'элементов на доске',
      icon: 'heroicons:squares-2x2',
    },
    {
      id: 'doing',
      label: 'В работе',
      value: String(stats.value.doing),
      hint: `${stats.value.doingPercent}% от всех`,
      icon: 'heroicons:bolt',
    },
    {
      id: 'done',
      label: 'Готово',
      value: String(stats.value.done),
      hint: `${stats.value.donePercent}% завершено`,
      icon: 'heroicons:check-circle',
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      value: formatSum(stats.value.wishlistSum),
      hint: 'сумма желаний',
      icon: 'heroicons:sparkles',
    },
  ]
})
</script>

<template>
  <section class="stats-panel" aria-label="Сводка доски">
    <div class="stats-panel__texture" aria-hidden="true"></div>

    <header class="stats-panel__head">
      <div class="stats-panel__title-wrap">
        <span class="stats-panel__eyebrow">Сводка</span>
        <h2 class="stats-panel__title">Пульс доски</h2>
      </div>
      <div v-if="!isLoading && stats" class="stats-panel__badge">
        <span class="stats-panel__pulse"></span>
        {{ stats.total }} активных
      </div>
    </header>

    <div v-if="isLoading" class="stats-panel__grid">
      <div v-for="i in 4" :key="i" class="stat-tile stat-tile--skeleton"></div>
    </div>

    <template v-else-if="stats">
      <div class="stats-panel__grid">
        <article
            v-for="(tile, index) in statTiles"
            :key="tile.id"
            class="stat-tile"
            :class="[`stat-tile--${tile.id}`]"
            :style="{ '--tile-delay': `${index * 70}ms` }"
        >
          <div class="stat-tile__rail" aria-hidden="true"></div>
          <div class="stat-tile__body">
            <span class="stat-tile__label">{{ tile.label }}</span>
            <span class="stat-tile__value tabular-nums">{{ tile.value }}</span>
            <span class="stat-tile__hint">{{ tile.hint }}</span>
          </div>
          <div class="stat-tile__icon-wrap" aria-hidden="true">
            <Icon :name="tile.icon" size="18"/>
          </div>
        </article>
      </div>

      <div class="stats-panel__progress" role="presentation">
        <div class="stats-panel__progress-labels">
          <span>В работе {{ stats.doing }}</span>
          <span>Готово {{ stats.done }}</span>
        </div>
        <div class="stats-panel__progress-track">
          <div
              class="stats-panel__progress-segment stats-panel__progress-segment--doing"
              :style="{ width: `${stats.doingPercent}%` }"
          ></div>
          <div
              class="stats-panel__progress-segment stats-panel__progress-segment--done"
              :style="{ width: `${stats.donePercent}%` }"
          ></div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped lang="sass">
.stats-panel
  position: relative
  margin-bottom: var(--spacing-5)
  padding: var(--spacing-5) var(--spacing-5) var(--spacing-4)
  border-radius: var(--radius-xl)
  border: 1px solid var(--color-border)
  background: linear-gradient(145deg, var(--color-card-bg) 0%, var(--color-bg-secondary) 100%)
  box-shadow: var(--shadow-sm)
  overflow: hidden

.stats-panel__texture
  position: absolute
  inset: 0
  opacity: 0.35
  background-image: radial-gradient(circle at 20% 0%, rgba(13, 148, 136, 0.12) 0%, transparent 42%), radial-gradient(circle at 90% 100%, rgba(236, 72, 153, 0.08) 0%, transparent 38%)
  pointer-events: none

.stats-panel__head
  position: relative
  z-index: 1
  display: flex
  align-items: flex-end
  justify-content: space-between
  gap: var(--spacing-4)
  margin-bottom: var(--spacing-4)

.stats-panel__eyebrow
  display: block
  font-size: 10px
  font-weight: 800
  letter-spacing: 0.14em
  text-transform: uppercase
  color: var(--color-primary)
  margin-bottom: 4px

.stats-panel__title
  margin: 0
  font-size: var(--font-size-lg)
  font-weight: 800
  letter-spacing: -0.3px
  color: var(--color-text)
  line-height: 1.1

.stats-panel__badge
  display: inline-flex
  align-items: center
  gap: 8px
  padding: 6px 12px
  border-radius: var(--radius-full)
  background-color: var(--color-primary-light)
  border: 1px solid var(--color-primary-muted)
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-primary)
  white-space: nowrap

.stats-panel__pulse
  width: 7px
  height: 7px
  border-radius: 50%
  background-color: var(--color-primary)
  box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.45)
  animation: stats-pulse 2.2s ease-out infinite

@keyframes stats-pulse
  0%
    box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.45)
  70%
    box-shadow: 0 0 0 8px rgba(13, 148, 136, 0)
  100%
    box-shadow: 0 0 0 0 rgba(13, 148, 136, 0)

.stats-panel__grid
  position: relative
  z-index: 1
  display: grid
  grid-template-columns: repeat(4, minmax(0, 1fr))
  gap: var(--spacing-3)

  @media (max-width: 1100px)
    grid-template-columns: repeat(2, minmax(0, 1fr))

  @media (max-width: 520px)
    grid-template-columns: 1fr

.stat-tile
  position: relative
  display: grid
  grid-template-columns: 4px 1fr auto
  gap: var(--spacing-3)
  align-items: center
  padding: var(--spacing-4)
  border-radius: var(--radius-lg)
  background-color: rgba(255, 255, 255, 0.72)
  border: 1px solid rgba(226, 232, 240, 0.9)
  min-height: 92px
  opacity: 0
  transform: translateY(8px)
  animation: stat-tile-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards
  animation-delay: var(--tile-delay, 0ms)
  transition: transform var(--transition-normal) ease, box-shadow var(--transition-normal) ease, border-color var(--transition-normal) ease

  &:hover
    box-shadow: var(--shadow-md)
    border-color: var(--color-border-hover)

  &--skeleton
    grid-template-columns: 1fr
    min-height: 92px
    background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%)
    background-size: 200% 100%
    animation: skeleton-shimmer 1.5s ease infinite
    border-color: transparent
    box-shadow: none

  &--total .stat-tile__rail
    background: linear-gradient(180deg, var(--color-text-muted), var(--color-text-tertiary))

  &--total .stat-tile__icon-wrap
    color: var(--color-text-secondary)
    background-color: var(--color-bg-secondary)

  &--doing .stat-tile__rail
    background: linear-gradient(180deg, var(--kanban-doing-color), #a78bfa)

  &--doing .stat-tile__icon-wrap
    color: var(--kanban-doing-color)
    background-color: var(--kanban-doing-bg)

  &--done .stat-tile__rail
    background: linear-gradient(180deg, var(--kanban-done-tracker-color), #059669)

  &--done .stat-tile__icon-wrap
    color: var(--kanban-done-tracker-color)
    background-color: var(--kanban-done-tracker-bg)

  &--wishlist
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(253, 242, 248, 0.95) 100%)

    .stat-tile__rail
      background: linear-gradient(180deg, var(--kanban-wishlist-color), #db2777)

    .stat-tile__icon-wrap
      color: var(--kanban-wishlist-color)
      background-color: var(--kanban-wishlist-bg)

    .stat-tile__value
      color: var(--kanban-wishlist-color)
      font-size: clamp(1rem, 2.5vw, var(--font-size-xl))

[data-theme="dark"] .stat-tile
  background-color: rgba(22, 27, 34, 0.85)
  border-color: rgba(48, 54, 61, 0.95)

  &--wishlist
    background: linear-gradient(135deg, rgba(22, 27, 34, 0.92) 0%, rgba(61, 21, 41, 0.55) 100%)

@keyframes stat-tile-in
  to
    opacity: 1
    transform: translateY(0)

@keyframes skeleton-shimmer
  0%
    background-position: 200% 0
  100%
    background-position: -200% 0

.stat-tile__rail
  align-self: stretch
  border-radius: var(--radius-full)
  min-height: 100%

.stat-tile__body
  min-width: 0
  display: flex
  flex-direction: column
  gap: 2px

.stat-tile__label
  font-size: 10px
  font-weight: 800
  letter-spacing: 0.12em
  text-transform: uppercase
  color: var(--color-text-muted)

.stat-tile__value
  font-size: clamp(1.25rem, 2.8vw, var(--font-size-2xl))
  font-weight: 800
  letter-spacing: -0.04em
  line-height: 1
  color: var(--color-text)
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.stat-tile__hint
  font-size: 11px
  font-weight: 600
  color: var(--color-text-tertiary)
  margin-top: 2px

.stat-tile__icon-wrap
  width: 36px
  height: 36px
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

.stats-panel__progress
  position: relative
  z-index: 1
  margin-top: var(--spacing-4)
  padding-top: var(--spacing-3)
  border-top: 1px dashed var(--color-border)

.stats-panel__progress-labels
  display: flex
  justify-content: space-between
  gap: var(--spacing-2)
  margin-bottom: 8px
  font-size: 11px
  font-weight: 700
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 0.06em

.stats-panel__progress-track
  display: flex
  width: 100%
  height: 6px
  border-radius: var(--radius-full)
  background-color: var(--color-bg-tertiary)
  overflow: hidden

.stats-panel__progress-segment
  height: 100%
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1)

  &--doing
    background: linear-gradient(90deg, var(--kanban-doing-color), #a78bfa)

  &--done
    background: linear-gradient(90deg, var(--kanban-done-tracker-color), #34d399)
</style>
