<script setup lang="ts">
import {toRaw} from 'vue'
import {useMutation, useQueryClient} from '@tanstack/vue-query'

import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {createCard} from '~/utils/appwrite-cards'
import {mapAppwriteError, isWishlistCategory} from '~/utils/card-priority'
import {WISHLIST_CATEGORY, WISHLIST_CATEGORY_LABEL} from '~/components/kanban/kanban.labels'
import {useBoardStore} from '~~/store/board.store'
import {useAuthStore} from '~~/store/auth.store'
import {buildRestorePayload, useAuthArchiveStore} from '~~/store/auth-archive.store'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

useSeoMeta({ title: 'Архив | Dealio' })
dayjs.locale('ru')

interface ArchiveListItem {
  id: string
  name: string
  price: number
  priority: string
  archivedAt?: string
  category: string
}

const authStore = useAuthStore()
const boardStore = useBoardStore()
const authArchiveStore = useAuthArchiveStore()
const queryClient = useQueryClient()

const isGuest = computed(() => authStore.isGuest)

onMounted(() => {
  if (import.meta.client && authStore.isGuest) {
    boardStore.init()
    boardStore.pruneExpired()
    return
  }

  if (import.meta.client && authStore.userId) {
    authArchiveStore.init(authStore.userId)
  }
})

const retentionDays = computed(() => boardStore.retentionDays)

const archivedCards = computed((): ArchiveListItem[] => {
  if (isGuest.value) {
    return boardStore.archivedCards.map(card => ({
      id: card.$id,
      name: card.name,
      price: card.price,
      priority: card.priority,
      archivedAt: card.archivedAt,
      category: card.customer?.name ?? '—',
    }))
  }

  return authArchiveStore.archivedCards.map(card => ({
    id: card.id,
    name: card.name,
    price: isWishlistCategory(card.category) ? card.price : 0,
    priority: card.priority,
    archivedAt: card.archivedAt,
    category: card.category,
  }))
})

const daysLeft = (archivedAt?: string): number => {
  if (!archivedAt) return retentionDays.value
  const elapsed = dayjs().diff(dayjs(archivedAt), 'day')
  return Math.max(0, retentionDays.value - elapsed)
}

const CATEGORY_COLUMN: Record<string, string> = {
  'Идея': 'ideas',
  'Задача': 'tasks',
  [WISHLIST_CATEGORY]: 'wishlist',
  [WISHLIST_CATEGORY_LABEL]: 'wishlist',
}

const columnIdFromCategory = (category: string) => CATEGORY_COLUMN[category] ?? 'tasks'

const formatArchivedAt = (date?: string) =>
  date ? dayjs(date).format('D MMMM YYYY') : '—'

const archiveRowTitle = (card: ArchiveListItem) => {
  const parts = [card.category]
  if (card.archivedAt) {
    parts.push(`Архивировано ${formatArchivedAt(card.archivedAt)}`)
  }
  return parts.join(' · ')
}

const {showSuccess, showError, showUndoDelete} = useAppToast()

const invalidateBoard = () => {
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}

const {mutate: restoreCard, isPending: isRestoring} = useMutation({
  mutationKey: ['restore-archive-card'],
  mutationFn: async (id: string) => {
    if (isGuest.value) {
      boardStore.restoreCard(id)
      return
    }

    const card = authArchiveStore.takeForRestore(id)
    if (!card) throw new Error('Карточка не найдена в архиве')

    const {documentId, payload} = buildRestorePayload(card)

    try {
      await createCard(documentId, payload)
    } catch (error) {
      authArchiveStore.archiveFromCard({
        id: card.id,
        name: card.name,
        price: card.price,
        category: card.category,
        status: card.status,
        priority: card.priority,
        $createdAt: card.$createdAt,
      })
      throw new Error(mapAppwriteError(error, 'Не удалось восстановить карточку'), {cause: error})
    }
  },
  onSuccess: () => {
    showSuccess('Карточка восстановлена')
    invalidateBoard()
  },
  onError: showError,
})

const handleRestore = (id: string) => {
  if (isRestoring.value) return
  restoreCard(id)
}

const handleDeletePermanently = (id: string) => {
  if (isGuest.value) {
    const card = boardStore.cards.find(item => item.$id === id)
    if (!card) return

    const snapshot = structuredClone(toRaw(card))
    boardStore.deleteCardPermanently(id)

    showUndoDelete(() => {
      boardStore.restoreDeletedArchivedCard(snapshot)
      invalidateBoard()
    })
  } else {
    const card = authArchiveStore.archivedCards.find(item => item.id === id)
    if (!card) return

    const snapshot = structuredClone(toRaw(card))
    authArchiveStore.remove(id)

    showUndoDelete(() => {
      authArchiveStore.restore(snapshot)
    })
  }

  invalidateBoard()
}

const formatPrice = (price: number) =>
  price.toLocaleString('ru-RU', {maximumFractionDigits: 0})
</script>

<template>
  <div class="archive-page">
    <header class="archive-header">
      <div class="archive-header__left">
        <h1 class="archive-title">Архив</h1>
        <span v-if="archivedCards.length" class="archive-count">{{ archivedCards.length }}</span>
      </div>
      <p class="archive-subtitle">
        Удалённые карточки хранятся {{ retentionDays }} дней, затем удаляются автоматически
      </p>
    </header>

    <div class="archive-surface">
      <div v-if="archivedCards.length === 0" class="archive-empty">
        <div class="empty-icon-wrap">
          <Icon name="heroicons:archive-box" size="36"/>
        </div>
        <p class="empty-title">Архив пуст</p>
        <p class="empty-hint">
          Наведите на карточку на доске и нажмите иконку архива — элемент переместится сюда.
        </p>
      </div>

      <div v-else class="archive-list-wrap">
        <div class="archive-list">
          <div
              v-for="(card, index) in archivedCards"
              :key="card.id"
              class="archive-row archive-row--enter"
              :title="archiveRowTitle(card)"
              :style="{ animationDelay: `${Math.min(index, 24) * 30}ms` }"
          >
            <span class="archive-row__name">{{ card.name }}</span>

            <div class="archive-row__right">
              <span
                  class="archive-row__countdown"
                  :class="{ 'countdown--urgent': daysLeft(card.archivedAt) <= 3 }"
              >
                <Icon name="heroicons:clock" size="11"/>
                <span v-if="daysLeft(card.archivedAt) === 0">Сегодня</span>
                <span v-else>{{ daysLeft(card.archivedAt) }} дн.</span>
              </span>

              <span
                  v-if="card.price > 0"
                  class="archive-row__price tabular-nums"
              >
                {{ formatPrice(card.price) }}
              </span>
              <span
                  v-else
                  class="archive-row__dot"
                  :class="`archive-row__dot--${columnIdFromCategory(card.category)}`"
              />

              <div class="archive-row__actions">
                <button
                    class="archive-action archive-action--restore"
                    :disabled="isRestoring"
                    aria-label="Восстановить"
                    title="Восстановить"
                    @click="handleRestore(card.id)"
                >
                  <Icon name="heroicons:arrow-uturn-left" size="13"/>
                </button>
                <button
                    class="archive-action archive-action--delete"
                    aria-label="Удалить навсегда"
                    title="Удалить навсегда"
                    @click="handleDeletePermanently(card.id)"
                >
                  <Icon name="heroicons:trash" size="13"/>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.archive-page
  display: flex
  flex-direction: column
  width: 100%

.archive-header
  flex-shrink: 0
  padding: var(--spacing-6) var(--spacing-6) var(--spacing-4)

  @media (max-width: 768px)
    padding: var(--spacing-4) var(--spacing-4) var(--spacing-3)

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

.archive-surface
  padding: 0 var(--spacing-6) var(--spacing-6)
  border-top: var(--border-width) solid var(--color-border)

  @media (max-width: 768px)
    padding: 0 var(--spacing-4) var(--spacing-4)

.archive-empty
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-3)
  padding: var(--spacing-12)
  text-align: center
  min-height: 300px

.empty-icon-wrap
  width: 64px
  height: 64px
  border-radius: var(--radius-xl)
  background-color: var(--color-bg-secondary)
  color: var(--color-text-muted)
  display: flex
  align-items: center
  justify-content: center
  opacity: 0.6

.empty-title
  font-size: var(--font-size-base)
  font-weight: 600
  color: var(--color-text-secondary)

.empty-hint
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  max-width: 360px
  line-height: 1.5

.archive-list-wrap
  max-width: 720px
  margin: 0 auto
  padding-top: var(--spacing-4)

.archive-list
  display: flex
  flex-direction: column

.archive-row
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  min-width: 0
  max-width: 100%
  overflow: hidden
  background-color: var(--kanban-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-bottom: none
  padding: 11px 12px
  transition: background-color var(--transition-fast) ease

  &--enter
    opacity: 0
    animation: row-in 0.2s ease forwards

  &:first-child
    border-radius: var(--radius-md) var(--radius-md) 0 0

  &:last-child
    border-bottom: var(--border-width) solid var(--color-card-border)
    border-radius: 0 0 var(--radius-md) var(--radius-md)

  &:hover,
  &:focus-within
    background-color: var(--color-bg-tertiary)

    .archive-row__actions
      opacity: 1

@keyframes row-in
  from
    opacity: 0
  to
    opacity: 1

.archive-row__name
  flex: 1 1 auto
  font-size: var(--font-size-sm)
  font-weight: 500
  color: var(--color-text)
  min-width: 0
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.archive-row__right
  display: flex
  align-items: center
  gap: var(--spacing-2)
  flex-shrink: 0
  min-width: 0

.archive-row__countdown
  display: inline-flex
  align-items: center
  gap: 4px
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-muted)
  white-space: nowrap
  transition: opacity var(--transition-fast) ease

  &.countdown--urgent
    color: var(--color-danger)

.archive-row__price
  max-width: 72px
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-secondary)
  font-family: var(--font-numeric)
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  flex-shrink: 0

.archive-row__dot
  width: 6px
  height: 6px
  border-radius: 50%
  flex-shrink: 0
  background-color: var(--color-text-muted)

  &--ideas
    background-color: var(--kanban-ideas-color)

  &--tasks
    background-color: var(--kanban-tasks-color)

  &--wishlist
    background-color: var(--kanban-wishlist-color)

.archive-row__actions
  display: flex
  align-items: center
  gap: 2px
  opacity: 0
  transition: opacity var(--transition-fast) ease

@media (hover: none), (max-width: 768px)
  .archive-row__actions
    opacity: 1

.archive-action
  width: 20px
  height: 20px
  display: flex
  align-items: center
  justify-content: center
  background: none
  border: none
  border-radius: var(--radius-sm)
  color: var(--color-text-muted)
  cursor: pointer
  padding: 0
  transition: all var(--transition-fast) ease

  &:disabled
    opacity: 0.6
    cursor: not-allowed

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

  &--restore:hover:not(:disabled)
    background-color: var(--color-bg-secondary)
    color: var(--color-primary)

  &--delete:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-danger)
</style>
