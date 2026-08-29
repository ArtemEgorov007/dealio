<script setup lang="ts">
import type {ErpReportRow} from '~/utils/erp-api'

defineProps<{rows: ErpReportRow[]}>()

const formatTons = (value: number): string => `${new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
}).format(value)} т`

const formatRub = (value: number): string => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value)

const rowMetrics = (row: ErpReportRow) => [
  {label: 'ТП за месяц', value: formatRub(row.productionRub)},
  {label: 'Отгружено', value: formatTons(row.shippedTons)},
  {label: 'В цехе', value: formatTons(row.inWorkshopTons)},
]
</script>

<template>
  <section class="erp-reports-table" aria-label="Детализация отчёта">
    <div class="erp-reports-table__heading">
      <ErpSectionLabel>Детализация</ErpSectionLabel>
      <span class="erp-reports-table__count">{{ rows.length }}</span>
    </div>

    <div class="erp-reports-table__rows">
      <article
          v-for="row in rows"
          :key="`${row.customer}-${row.contract}-${row.site}`"
          class="erp-reports-table__row"
      >
        <header class="erp-reports-table__head">
          <strong class="erp-reports-table__customer">{{ row.customer }}</strong>
          <p class="erp-reports-table__meta">
            <span>{{ row.contract }}</span>
            <span class="erp-reports-table__dot" aria-hidden="true">·</span>
            <span>{{ row.site }}</span>
          </p>
        </header>

        <dl class="erp-reports-table__metrics">
          <div v-for="metric in rowMetrics(row)" :key="metric.label" class="erp-reports-table__metric">
            <dt>{{ metric.label }}</dt>
            <dd>{{ metric.value }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped lang="sass">
.erp-reports-table
  display: grid
  gap: 10px

.erp-reports-table__heading
  display: flex
  align-items: center
  justify-content: space-between
  gap: 10px
  padding-right: 4px

.erp-reports-table__count
  min-width: 28px
  height: 28px
  padding: 0 8px
  border-radius: 999px
  display: inline-flex
  align-items: center
  justify-content: center
  background: rgba(1, 110, 215, 0.1)
  color: #016ED7
  font-size: 12px
  font-weight: 700
  font-variant-numeric: tabular-nums

.erp-reports-table__rows
  display: grid
  gap: 10px

.erp-reports-table__row
  display: grid
  gap: 14px
  padding: 16px
  border-radius: 16px
  border: 0.5px solid rgba(60, 60, 67, 0.12)
  background: #fff
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06)

.erp-reports-table__head
  display: grid
  gap: 6px

.erp-reports-table__customer
  margin: 0
  font-size: 16px
  font-weight: 700
  line-height: 1.25
  color: var(--color-text)

.erp-reports-table__meta
  margin: 0
  display: flex
  flex-wrap: wrap
  align-items: center
  gap: 6px
  font-size: 13px
  line-height: 1.35
  color: var(--color-text-secondary)

.erp-reports-table__dot
  opacity: 0.55

.erp-reports-table__metrics
  display: grid
  grid-template-columns: repeat(3, minmax(0, 1fr))
  gap: 8px
  margin: 0
  padding-top: 2px
  border-top: 0.5px solid rgba(60, 60, 67, 0.1)

.erp-reports-table__metric
  min-width: 0
  display: grid
  gap: 4px
  padding-top: 10px

  dt
    margin: 0
    font-size: 11px
    font-weight: 600
    line-height: 1.25
    color: var(--color-text-secondary)

  dd
    margin: 0
    overflow-wrap: anywhere
    font-size: 14px
    font-weight: 700
    line-height: 1.2
    color: var(--color-text)
    font-variant-numeric: tabular-nums

@media (max-width: 480px)
  .erp-reports-table__metrics
    grid-template-columns: 1fr
    gap: 0

  .erp-reports-table__metric
    grid-template-columns: 1fr auto
    align-items: baseline
    gap: 12px
    padding-top: 10px

    &:not(:last-child)
      padding-bottom: 10px
      border-bottom: 0.5px solid rgba(60, 60, 67, 0.08)

  .erp-reports-table__metric dd
    text-align: right
</style>
