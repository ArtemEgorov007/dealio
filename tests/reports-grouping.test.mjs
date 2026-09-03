import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import {loadTsModule} from './helpers/load-ts.mjs'

const rows = [
  {customer: 'Альфа', contract: 'Д-1', site: 'Колпино', productionRub: 1_000_000, shippedTons: 500, inWorkshopTons: 10},
  {customer: 'Альфа', contract: 'Д-1', site: 'Волхонка', productionRub: 500_000, shippedTons: 250, inWorkshopTons: 5},
  {customer: 'Бета', contract: 'Д-2', site: 'Колпино', productionRub: 250_000, shippedTons: 250, inWorkshopTons: 2},
]

test('groupReportRows by contract aggregates sites and totals', async () => {
  const {groupReportRows} = await loadTsModule(new URL('../app/utils/erp-report-grouping.ts', import.meta.url))
  const groups = groupReportRows(rows, 'contract')

  assert.equal(groups.length, 2)
  assert.equal(groups[0].title, 'Д-1')
  assert.equal(groups[0].subtitle, 'Альфа')
  assert.deepEqual(groups[0].rows.map(row => row.label), ['Колпино', 'Волхонка'])
  assert.equal(groups[0].totals.productionRub, 1_500_000)
  assert.equal(groups[0].totals.shippedTons, 750)
  assert.equal(groups[1].title, 'Д-2')
  assert.equal(groups[1].rows[0].label, 'Колпино')
})

test('groupReportRows by site aggregates contracts and totals', async () => {
  const {groupReportRows} = await loadTsModule(new URL('../app/utils/erp-report-grouping.ts', import.meta.url))
  const groups = groupReportRows(rows, 'site')

  assert.equal(groups.length, 2)
  assert.equal(groups[0].title, 'Колпино')
  assert.deepEqual(groups[0].rows.map(row => row.label), ['Д-1', 'Д-2'])
  assert.equal(groups[0].totals.productionRub, 1_250_000)
  assert.equal(groups[0].totals.shippedTons, 750)
  assert.equal(groups[1].title, 'Волхонка')
})

test('groupReportRows by customer aggregates contracts across sites', async () => {
  const {groupReportRows} = await loadTsModule(new URL('../app/utils/erp-report-grouping.ts', import.meta.url))
  const groups = groupReportRows(rows, 'customer')

  assert.equal(groups.length, 2)
  assert.equal(groups[0].title, 'Альфа')
  // Д-1 встречается у Альфы на двух площадках — по заказчику это один
  // договор, строки сливаются, а не дублируются на площадку.
  assert.deepEqual(groups[0].rows.map(row => row.label), ['Д-1'])
  assert.equal(groups[0].totals.productionRub, 1_500_000)
  assert.equal(groups[0].totals.shippedTons, 750)
  assert.equal(groups[0].subtitle, undefined)
  assert.equal(groups[1].title, 'Бета')
  assert.equal(groups[1].rows[0].label, 'Д-2')
})

test('groupReportRows keeps source order, empty input, and blank keys as dash', async () => {
  const {groupReportRows} = await loadTsModule(new URL('../app/utils/erp-report-grouping.ts', import.meta.url))

  assert.deepEqual(groupReportRows([], 'contract'), [])

  const blank = groupReportRows([
    {customer: 'X', contract: '', site: 'A', productionRub: 1, shippedTons: 1, inWorkshopTons: 0},
  ], 'contract')
  assert.equal(blank[0].title, '—')

  const mixedCustomer = groupReportRows([
    {customer: 'Альфа', contract: 'Д-9', site: 'A', productionRub: 1, shippedTons: 1, inWorkshopTons: 0},
    {customer: 'Бета', contract: 'Д-9', site: 'B', productionRub: 2, shippedTons: 2, inWorkshopTons: 0},
  ], 'contract')
  assert.equal(mixedCustomer[0].subtitle, undefined)

  // Пустой заказчик — это отсутствие данных, а не значение «—»: подписью
  // группы прочерк быть не должен, иначе на реальных данных GAS (где ячейка
  // «Заказчик» бывает не заполнена) под каждым договором висел бы фиктивный «—».
  const blankCustomer = groupReportRows([
    {customer: '', contract: 'Д-10', site: 'A', productionRub: 1, shippedTons: 1, inWorkshopTons: 0},
  ], 'contract')
  assert.equal(blankCustomer[0].subtitle, undefined)
})

test('reports detail UI exposes grouping tabs without changing flat metrics', async () => {
  const table = await readFile(new URL('../app/components/erp/ErpReportsTable.vue', import.meta.url), 'utf8')
  assert.match(table, /UiSegmentedControl/)
  assert.match(table, /Раздельно/)
  assert.match(table, /Договор/)
  assert.match(table, /Площадка/)
  assert.match(table, /Заказчик/)
  assert.match(table, /Итого/)
  assert.match(table, /groupReportRows/)
  assert.match(table, /ref(?:<[^>]+>)?\(['"]flat['"]\)/)
  assert.equal([...table.matchAll(/В цехе/g)].length, 1)
})
