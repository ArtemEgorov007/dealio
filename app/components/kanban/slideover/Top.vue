<script setup lang="ts">
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {useDealSlideStore} from '~~/store/deal-slide.store'

dayjs.locale('ru')

const store = useDealSlideStore()

const formatDate = (date?: string): string =>
    date ? dayjs(date).format('D MMMM YYYY') : '—'

const formatCurrency = (value?: number): string =>
    typeof value === 'number' ? `${value.toLocaleString('ru-RU')} ₽` : '—'

const statusLabels: Record<string, string> = {
  'todo': 'Входящие',
  'to-be-agreed': 'Согласование',
  'in-progress': 'В работе',
  'produced': 'Произведено',
  'done': 'Завершено'
}

const statusVariants: Record<string, string> = {
  'todo': 'secondary',
  'to-be-agreed': 'info',
  'in-progress': 'warning',
  'produced': 'primary',
  'done': 'success'
}
</script>

<template>
  <div class="deal-info">
    <div class="deal-info__name-row">
      <h2 class="deal-info__name">{{ store.card?.name || '—' }}</h2>
    </div>

    <div class="deal-info__price-row">
      <span class="deal-info__price tabular-nums">{{ formatCurrency(store.card?.price) }}</span>
    </div>

    <div class="deal-info__divider"></div>

    <div class="deal-info__grid">
      <div class="deal-info__field">
        <span class="field-label">Клиент</span>
        <span class="field-value">{{ store.card?.companyName || '—' }}</span>
      </div>

      <div class="deal-info__field">
        <span class="field-label">Статус</span>
        <UiBadge :variant="(statusVariants[store.card?.status || ''] as any) || 'secondary'">
          {{ statusLabels[store.card?.status || ''] || store.card?.status || '—' }}
        </UiBadge>
      </div>

      <div class="deal-info__field">
        <span class="field-label">Дата создания</span>
        <span class="field-value">{{ formatDate(store.card?.$createdAt) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="sass">
.deal-info
  display: flex
  flex-direction: column
  gap: var(--spacing-4)

.deal-info__name-row
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: var(--spacing-3)

.deal-info__name
  font-size: var(--font-size-xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.3px
  line-height: 1.25

.deal-info__price-row
  display: flex
  align-items: baseline
  gap: var(--spacing-2)

.deal-info__price
  font-size: var(--font-size-4xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -1px
  line-height: 1
  font-variant-numeric: tabular-nums
  font-feature-settings: "tnum"

.deal-info__divider
  height: 1px
  background-color: var(--color-border)
  margin: var(--spacing-1) 0

.deal-info__grid
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.deal-info__field
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
</style>
