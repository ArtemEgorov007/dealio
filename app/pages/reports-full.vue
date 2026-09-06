<script setup lang="ts">
import {fetchCurrentReports} from '~/utils/erp-sheets'
import type {ErpCurrentReport, ErpReportRow} from '~/utils/erp-api'
import {groupReportRows} from '~/utils/erp-report-grouping'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Полный отчёт | ERP'})

// Тот же лист, что «Отчёт месяца» (fetchCurrentReports), но метрики за весь
// период работы, а не за месяц: колонки D и E листа. Дублировать запрос к
// мосту под этот экран не нужно — лист один и тот же.
const report = ref<ErpCurrentReport | null>(null)
const loading = ref(true)
const error = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    report.value = await fetchCurrentReports()
  } catch (loadError) {
    error.value = errorMessage(loadError, 'Не удалось загрузить отчёт')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Единицы измерения — только в шапке блока, в значениях они не нужны.
const formatAmount = (value: number): string => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
}).format(value)

const formatTons = (value: number): string => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
}).format(value)

type DetailMode = 'flat' | 'contract' | 'site' | 'customer'
const mode = ref<DetailMode>('flat')
const MODE_OPTIONS = [
  {value: 'flat', label: 'Раздельно'},
  {value: 'contract', label: 'Договор'},
  {value: 'site', label: 'Площадка'},
  {value: 'customer', label: 'Заказчик'},
]

const rows = computed<ErpReportRow[]>(() => report.value?.rows ?? [])

const rowMetrics = (row: ErpReportRow) => [
  {label: 'ТП, ₽', value: formatAmount(row.productionTotalRub)},
  {label: 'Отгружено, т', value: formatTons(row.shippedTotalTons)},
]

const groups = computed(() => {
  if (mode.value === 'flat') return []
  return groupReportRows(rows.value, mode.value)
})

const groupColumnLabel = computed(() => mode.value === 'contract' ? 'Площадка' : 'Договор')
</script>

<template>
  <ErpScreen
      title="Полный отчёт"
      subtitle="ТП и отгрузка за весь период"
      icon="heroicons:document-chart-bar"
      :shift-link="{to: '/reports', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <template #actions>
      <UiButton
          v-if="report || error"
          size="sm"
          variant="inverse"
          :loading="loading"
          @click="load"
      >
        Обновить
      </UiButton>
    </template>

    <ErpEmptyState v-if="loading && !report" loading>
      Загружаем отчёт…
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else-if="report">
      <ErpEmptyState v-if="rows.length === 0">
        <p>В отчёте пока нет заполненных строк</p>
        <UiButton variant="outline" @click="load">Обновить</UiButton>
      </ErpEmptyState>

      <section v-else class="full-report-table" aria-label="Детализация полного отчёта">
        <div class="full-report-table__heading">
          <div class="full-report-table__heading-start">
            <ErpSectionLabel>Детализация</ErpSectionLabel>
            <span class="full-report-table__count">{{ rows.length }}</span>
          </div>
          <UiSegmentedControl
              class="full-report-table__modes"
              :model-value="mode"
              :options="MODE_OPTIONS"
              align="start"
              @update:model-value="mode = $event as DetailMode"
          />
        </div>

        <div v-if="mode === 'flat'" class="full-report-table__rows">
          <article
              v-for="row in rows"
              :key="`${row.customer}-${row.contract}-${row.site}`"
              class="full-report-table__row"
          >
            <header class="full-report-table__head">
              <strong>{{ row.customer }}</strong>
              <p class="full-report-table__meta">
                <span>{{ row.contract }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ row.site }}</span>
              </p>
            </header>

            <dl class="full-report-table__metrics">
              <div v-for="metric in rowMetrics(row)" :key="metric.label" class="full-report-table__metric">
                <dt>{{ metric.label }}</dt>
                <dd>{{ metric.value }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <div v-else class="full-report-table__groups">
          <article v-for="group in groups" :key="group.key" class="full-report-table__group">
            <header class="full-report-table__group-head">
              <strong>{{ group.title }}</strong>
              <p v-if="group.subtitle">{{ group.subtitle }}</p>
            </header>

            <div class="full-report-table__grid" role="table" :aria-label="`Группа ${group.title}`">
              <div class="full-report-table__grid-head" role="row">
                <span role="columnheader">{{ groupColumnLabel }}</span>
                <span role="columnheader">ТП, ₽</span>
                <span role="columnheader">Отгр., т</span>
              </div>
              <div v-for="line in group.rows" :key="line.label" class="full-report-table__grid-row" role="row">
                <span role="cell">{{ line.label }}</span>
                <span role="cell">{{ formatAmount(line.productionTotalRub) }}</span>
                <span role="cell">{{ formatTons(line.shippedTotalTons) }}</span>
              </div>
              <div class="full-report-table__grid-row full-report-table__grid-row--total" role="row">
                <span role="cell">Итого</span>
                <span role="cell">{{ formatAmount(group.totals.productionTotalRub) }}</span>
                <span role="cell">{{ formatTons(group.totals.shippedTotalTons) }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.full-report-table
  display: grid
  gap: 10px

.full-report-table__heading
  display: flex
  flex-wrap: wrap
  align-items: center
  gap: 10px
  padding-right: 4px

.full-report-table__heading-start
  display: flex
  align-items: center
  gap: 8px
  min-width: 0

.full-report-table__modes
  margin-left: auto

.full-report-table__count
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

.full-report-table__rows,
.full-report-table__groups
  display: grid
  gap: 10px

.full-report-table__row,
.full-report-table__group
  display: grid
  gap: 14px
  padding: 16px
  border-radius: 16px
  border: 0.5px solid rgba(60, 60, 67, 0.12)
  background: #fff
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06)

.full-report-table__head,
.full-report-table__group-head
  display: grid
  gap: 6px

  strong
    margin: 0
    font-size: 16px
    font-weight: 700
    color: var(--color-text)

.full-report-table__meta,
.full-report-table__group-head p
  margin: 0
  display: flex
  flex-wrap: wrap
  align-items: center
  gap: 6px
  font-size: 13px
  color: var(--color-text-secondary)

.full-report-table__metrics
  display: grid
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr))
  gap: 8px
  margin: 0
  padding-top: 2px
  border-top: 0.5px solid rgba(60, 60, 67, 0.1)

.full-report-table__metric
  min-width: 0
  display: grid
  gap: 4px
  padding-top: 10px

  dt
    margin: 0
    font-size: 11px
    font-weight: 600
    color: var(--color-text-secondary)

  dd
    margin: 0
    overflow-wrap: anywhere
    // Значения — по правому краю колонки на любой ширине, как в таблице.
    text-align: right
    font-size: 14px
    font-weight: 700
    color: var(--color-text)
    font-variant-numeric: tabular-nums

.full-report-table__grid
  display: grid
  gap: 0

.full-report-table__grid-head,
.full-report-table__grid-row
  display: grid
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.9fr)
  gap: 6px
  align-items: baseline

.full-report-table__grid-head
  padding-bottom: 8px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.1)
  font-size: 11px
  font-weight: 600
  color: var(--color-text-secondary)

  span:not(:first-child)
    text-align: right

.full-report-table__grid-row
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
  .full-report-table__modes
    margin-left: 0
    width: 100%

  .full-report-table__metrics
    grid-template-columns: 1fr
    gap: 0

  .full-report-table__metric
    grid-template-columns: 1fr auto
    align-items: baseline
    gap: 12px
    padding-top: 10px

    &:not(:last-child)
      padding-bottom: 10px
      border-bottom: 0.5px solid rgba(60, 60, 67, 0.08)

  .full-report-table__grid-head,
  .full-report-table__grid-row
    grid-template-columns: minmax(0, 1fr) auto auto
    gap: 12px
</style>
