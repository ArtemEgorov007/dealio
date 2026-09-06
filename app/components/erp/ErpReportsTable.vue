<script setup lang="ts">
import type {ErpReportRow} from '~/utils/erp-api'
import {groupReportRows} from '~/utils/erp-report-grouping'

const props = defineProps<{rows: ErpReportRow[]}>()

type DetailMode = 'flat' | 'contract' | 'site' | 'customer'

const mode = ref<DetailMode>('flat')

const MODE_OPTIONS = [
  {value: 'flat', label: 'Раздельно'},
  {value: 'contract', label: 'Договор'},
  {value: 'site', label: 'Площадка'},
  {value: 'customer', label: 'Заказчик'},
]

// Единицы измерения живут в шапке блока, а не в значениях: колонка чисел
// без хвостов «т»/«₽» читается взглядом сверху вниз, а не по слогам.
const formatAmount = (value: number): string => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
}).format(value)

// Тонны и квадратные метры бывают дробными — знак после запятой показываем
// только когда он есть, иначе колонка пестрит нулями.
const formatDecimal = (value: number): string => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
}).format(value)

const rowMetrics = (row: ErpReportRow) => [
  {label: 'ТП за месяц, ₽', value: formatAmount(row.productionRub)},
  {label: 'Отгружено, т', value: formatDecimal(row.shippedTons)},
  {label: 'Отгружено, м²', value: formatDecimal(row.shippedSquareMeters)},
  {label: 'В цехе, т', value: formatDecimal(row.inWorkshopTons)},
]

const groups = computed(() => {
  if (mode.value === 'flat') return []
  return groupReportRows(props.rows, mode.value)
})

const groupColumnLabel = computed(() => mode.value === 'contract' ? 'Площадка' : 'Договор')
</script>

<template>
  <section class="erp-reports-table" aria-label="Детализация отчёта">
    <div class="erp-reports-table__heading">
      <div class="erp-reports-table__heading-start">
        <ErpSectionLabel>Детализация</ErpSectionLabel>
        <span class="erp-reports-table__count">{{ rows.length }}</span>
      </div>
      <UiSegmentedControl
          class="erp-reports-table__modes"
          :model-value="mode"
          :options="MODE_OPTIONS"
          align="start"
          @update:model-value="mode = $event as DetailMode"
      />
    </div>

    <div v-if="mode === 'flat'" class="erp-reports-table__rows">
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

    <div v-else class="erp-reports-table__groups">
      <article
          v-for="group in groups"
          :key="group.key"
          class="erp-reports-table__group"
      >
        <header class="erp-reports-table__group-head">
          <strong>{{ group.title }}</strong>
          <p v-if="group.subtitle">{{ group.subtitle }}</p>
        </header>

        <div class="erp-reports-table__grid" role="table" :aria-label="`Группа ${group.title}`">
          <div class="erp-reports-table__grid-head" role="row">
            <span role="columnheader">{{ groupColumnLabel }}</span>
            <span role="columnheader">ТП, ₽</span>
            <span role="columnheader">Отгр., т</span>
            <span role="columnheader">Отгр., м²</span>
          </div>
          <div
              v-for="line in group.rows"
              :key="line.label"
              class="erp-reports-table__grid-row"
              role="row"
          >
            <span role="cell">{{ line.label }}</span>
            <span role="cell">{{ formatAmount(line.productionRub) }}</span>
            <span role="cell">{{ formatDecimal(line.shippedTons) }}</span>
            <span role="cell">{{ formatDecimal(line.shippedSquareMeters) }}</span>
          </div>
          <div class="erp-reports-table__grid-row erp-reports-table__grid-row--total" role="row">
            <span role="cell">Итого</span>
            <span role="cell">{{ formatAmount(group.totals.productionRub) }}</span>
            <span role="cell">{{ formatDecimal(group.totals.shippedTons) }}</span>
            <span role="cell">{{ formatDecimal(group.totals.shippedSquareMeters) }}</span>
          </div>
        </div>
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
  flex-wrap: wrap
  align-items: center
  gap: 10px
  padding-right: 4px

.erp-reports-table__heading-start
  display: flex
  align-items: center
  gap: 8px
  min-width: 0

.erp-reports-table__modes
  margin-left: auto

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

.erp-reports-table__rows,
.erp-reports-table__groups
  display: grid
  gap: 10px

.erp-reports-table__row,
.erp-reports-table__group
  display: grid
  gap: 14px
  padding: 16px
  border-radius: 16px
  border: 0.5px solid rgba(60, 60, 67, 0.12)
  background: #fff
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06)

.erp-reports-table__head,
.erp-reports-table__group-head
  display: grid
  gap: 6px

.erp-reports-table__customer,
.erp-reports-table__group-head strong
  margin: 0
  font-size: 16px
  font-weight: 700
  line-height: 1.25
  color: var(--color-text)

.erp-reports-table__meta,
.erp-reports-table__group-head p
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
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr))
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
    // Значения выровнены по правому краю колонки на любой ширине: так
    // разряды стоят друг под другом и суммы сравниваются взглядом.
    text-align: right
    font-size: 14px
    font-weight: 700
    line-height: 1.2
    color: var(--color-text)
    font-variant-numeric: tabular-nums

.erp-reports-table__grid
  display: grid
  gap: 0

.erp-reports-table__grid-head,
.erp-reports-table__grid-row
  display: grid
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.75fr) minmax(0, 0.85fr)
  gap: 6px
  align-items: baseline

.erp-reports-table__grid-head
  padding-bottom: 8px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.1)
  font-size: 11px
  font-weight: 600
  color: var(--color-text-secondary)

  span:not(:first-child)
    text-align: right

.erp-reports-table__grid-row
  padding: 10px 0
  font-size: 13px
  color: var(--color-text)
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.08)

  span:first-child
    overflow-wrap: anywhere
    min-width: 0

  span:not(:first-child)
    text-align: right
    font-variant-numeric: tabular-nums
    font-weight: 600

  &--total
    border-bottom: 0
    border-top: 0.5px solid rgba(60, 60, 67, 0.16)
    font-weight: 700

    span
      font-weight: 700

@media (max-width: 480px)
  .erp-reports-table__modes
    margin-left: 0
    width: 100%

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

  .erp-reports-table__grid-head,
  .erp-reports-table__grid-row
    // Числовые колонки на телефоне разводим зазором: вплотную «1 000 000
    // 500 12 500» читается одной строкой, и правый край столбца пропадает.
    grid-template-columns: minmax(0, 1fr) auto auto auto
    gap: 12px
</style>
