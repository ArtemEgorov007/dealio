<script setup lang="ts">
import type {ErpCurrentReport} from '~/utils/erp-api'

const props = defineProps<{
  report: ErpCurrentReport
}>()

const formatTons = (value: number): string => `${new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
}).format(value)} т`

const formatRub = (value: number): string => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value)

const formattedPeriod = computed(() => {
  const [yearText, monthText] = props.report.period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return props.report.period
  }
  return new Intl.DateTimeFormat('ru-RU', {month: 'long', year: 'numeric'}).format(new Date(year, month - 1, 1))
})

const formattedUpdatedAt = computed(() => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(props.report.updatedAt)))

const metrics = computed(() => [
  {
    key: 'production',
    label: 'ТП за месяц',
    value: formatRub(props.report.summary.productionRub),
    unit: '₽',
    tone: '#016ED7',
  },
  {
    key: 'shipped',
    label: 'Отгружено',
    value: formatTons(props.report.summary.shippedTons),
    unit: 'т',
    tone: '#2FB463',
  },
  {
    key: 'workshop',
    label: 'В цехе',
    value: formatTons(props.report.summary.inWorkshopTons),
    unit: 'т',
    tone: '#5B6B7F',
  },
])
</script>

<template>
  <section class="erp-reports-summary" aria-label="Сводка за текущий месяц">
    <header class="erp-reports-summary__intro">
      <div>
        <p class="erp-reports-summary__period">{{ formattedPeriod }}</p>
        <p class="erp-reports-summary__updated">Обновлено {{ formattedUpdatedAt }}</p>
      </div>
    </header>

    <div class="erp-reports-summary__grid">
      <article
          v-for="metric in metrics"
          :key="metric.key"
          class="erp-reports-summary__metric"
          :style="{'--metric-tone': metric.tone}"
      >
        <span class="erp-reports-summary__label">{{ metric.label }}</span>
        <strong class="erp-reports-summary__value">{{ metric.value }}</strong>
      </article>
    </div>
  </section>
</template>

<style scoped lang="sass">
.erp-reports-summary
  display: grid
  gap: 14px

.erp-reports-summary__intro
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: 12px
  padding: 0 2px

.erp-reports-summary__period
  margin: 0
  font-size: 15px
  font-weight: 700
  line-height: 1.25
  color: var(--color-text)
  text-transform: capitalize

.erp-reports-summary__updated
  margin: 4px 0 0
  font-size: 12px
  line-height: 1.35
  color: var(--color-text-secondary)

.erp-reports-summary__grid
  display: grid
  grid-template-columns: repeat(3, minmax(0, 1fr))
  gap: 10px

.erp-reports-summary__metric
  min-width: 0
  display: grid
  gap: 10px
  padding: 14px 12px 14px 14px
  border-radius: 16px
  border: 0.5px solid rgba(60, 60, 67, 0.12)
  background: #fff
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06)
  position: relative
  overflow: hidden

  &::before
    content: ''
    position: absolute
    left: 0
    top: 10px
    bottom: 10px
    width: 3px
    border-radius: 999px
    background: var(--metric-tone, #016ED7)

.erp-reports-summary__label
  padding-left: 6px
  font-size: 11px
  font-weight: 600
  line-height: 1.3
  letter-spacing: 0.02em
  text-transform: uppercase
  color: var(--color-text-secondary)

.erp-reports-summary__value
  padding-left: 6px
  overflow-wrap: anywhere
  font-size: clamp(17px, 4.6vw, 22px)
  font-weight: 800
  line-height: 1.1
  color: var(--color-text)
  font-variant-numeric: tabular-nums

@media (max-width: 480px)
  .erp-reports-summary__grid
    grid-template-columns: 1fr

  .erp-reports-summary__metric
    grid-template-columns: 1fr auto
    align-items: center
    gap: 8px 12px

  .erp-reports-summary__value
    text-align: right
    font-size: 20px
</style>
