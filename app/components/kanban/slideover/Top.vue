<script setup lang="ts">
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {useCardSlideStore} from '~~/store/card-slide.store'
import {COLUMN_LABELS, PRIORITY_LABELS} from '~/components/kanban/kanban.labels'
import {EnumStatus} from '~~/types/cards.types'

dayjs.locale('ru')

const store = useCardSlideStore()

const formatDate = (date?: string): string =>
    date ? dayjs(date).format('D MMMM YYYY') : '—'

const priorityLevel = computed(() => {
  const value = store.card?.price
  if (!value || value < 1 || value > 5) return 0
  return value
})

const statusLabels = COLUMN_LABELS

const statusVariants: Record<string, string> = {
  'todo': 'secondary',
  'to-be-agreed': 'info',
  'in-progress': 'warning',
  'produced': 'primary',
  'done': 'success'
}
</script>

<template>
  <div class="card-info">
    <div class="card-info__name-row">
      <h2 class="card-info__name">{{ store.card?.name || '—' }}</h2>
    </div>

    <div v-if="priorityLevel" class="card-info__priority">
      <div class="priority-dots">
        <span
            v-for="n in 5"
            :key="n"
            class="priority-dot"
            :class="{ 'priority-dot--active': n <= priorityLevel }"
        />
      </div>
      <span class="priority-text">{{ PRIORITY_LABELS[priorityLevel] }}</span>
    </div>

    <div class="card-info__divider"></div>

    <div class="card-info__grid">
      <div class="card-info__field">
        <span class="field-label">Категория</span>
        <span class="field-value field-value--category">{{ store.card?.category || '—' }}</span>
      </div>

      <div class="card-info__field">
        <span class="field-label">Статус</span>
        <UiBadge :variant="(statusVariants[store.card?.status || ''] as any) || 'secondary'">
          {{ statusLabels[store.card?.status as EnumStatus] || store.card?.status || '—' }}
        </UiBadge>
      </div>

      <div class="card-info__field">
        <span class="field-label">Дата создания</span>
        <span class="field-value">{{ formatDate(store.card?.$createdAt) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.card-info
  display: flex
  flex-direction: column
  gap: var(--spacing-4)

.card-info__name-row
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: var(--spacing-3)

.card-info__name
  font-size: var(--font-size-xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.3px
  line-height: 1.25

.card-info__priority
  display: flex
  align-items: center
  gap: var(--spacing-3)

.priority-dots
  display: flex
  gap: 4px

.priority-dot
  width: 8px
  height: 8px
  border-radius: 50%
  background-color: var(--color-border)

  &--active
    background-color: var(--color-accent)

.priority-text
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text-secondary)

.card-info__divider
  height: 1px
  background-color: var(--color-border)
  margin: var(--spacing-1) 0

.card-info__grid
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.card-info__field
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  padding: var(--spacing-2) 0
  border-bottom: var(--border-width) solid var(--color-border)

  &:last-child
    border-bottom: none

.field-label
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 0.5px
  flex-shrink: 0

.field-value
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  text-align: right

  &--category
    color: var(--color-primary)
</style>
