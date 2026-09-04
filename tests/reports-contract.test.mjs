import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const gas = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8')
const reports = await readFile(new URL('../public/api/src/Reports.php', import.meta.url), 'utf8')
const hub = await readFile(new URL('../app/pages/reports.vue', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/reports-month.vue', import.meta.url), 'utf8')
const fullPage = await readFile(new URL('../app/pages/reports-full.vue', import.meta.url), 'utf8')
const ksPage = await readFile(new URL('../app/pages/reports-ks.vue', import.meta.url), 'utf8')
const idPage = await readFile(new URL('../app/pages/reports-id.vue', import.meta.url), 'utf8')
const summary = await readFile(new URL('../app/components/erp/ErpReportsSummary.vue', import.meta.url), 'utf8').catch(() => '')
const table = await readFile(new URL('../app/components/erp/ErpReportsTable.vue', import.meta.url), 'utf8').catch(() => '')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')
const indexPhp = await readFile(new URL('../public/api/index.php', import.meta.url), 'utf8')
const sections = await readFile(new URL('../app/utils/erp-sections.ts', import.meta.url), 'utf8')
const middleware = await readFile(new URL('../app/middleware/erp-flow.global.ts', import.meta.url), 'utf8')

test('GAS exposes a token-protected read-only reports bridge with exact columns', () => {
  assert.match(gas, /action === 'reportsCurrent'/)
  assert.match(gas, /REPORTS_BRIDGE_TOKEN/)
  assert.match(gas, /REPORTS_SPREADSHEET_ID/)
  assert.match(gas, /'ТП за месяц, тн'/)
  assert.match(gas, /'Отгружено за месяц, тн'/)
  assert.match(gas, /'В цехе, тн'/)
})

test('reports client uses same-origin API and exposes named units', () => {
  assert.match(api, /export async function fetchReportsCurrentViaApi/)
  assert.match(api, /reports\/current/)
  assert.match(api, /productionRub: number/)
  assert.match(api, /shippedTons: number/)
  assert.match(api, /inWorkshopTons: number/)
})

test('reports server follows the standard Apps Script redirect without exposing the bridge to browsers', () => {
  assert.match(reports, /CURLOPT_FOLLOWLOCATION\s*=>\s*true/)
  assert.match(reports, /erp_require_user/)
  assert.match(reports, /erp_require_permission\([^\n]+['"]reports['"]/)
})

test('reports page renders all three mandatory metrics with correct units and retry state', () => {
  assert.match(summary, /ТП за месяц/)
  assert.match(summary, /formatRub/)
  assert.match(summary, /Отгружено/)
  assert.match(summary, /В цехе/)
  assert.match(page, /Повторить/)
  assert.match(page, /fetchCurrentReports/)
  assert.match(table, /customer/)
  assert.match(summary, /<\/style>/)
  assert.match(table, /<\/style>/)
})

test('раздел «Отчёты» — хаб из 4 плиток, существующий экран переехал на «Отчёт месяца»', () => {
  assert.match(hub, /to: '\/reports-month'/)
  assert.match(hub, /label: 'Месячный отчёт'/)
  assert.match(hub, /to: '\/reports-full'/)
  assert.match(hub, /label: 'Полный отчёт'/)
  assert.match(hub, /to: '\/reports-ks'/)
  assert.match(hub, /label: 'КС'/)
  assert.match(hub, /to: '\/reports-id'/)
  assert.match(hub, /label: 'ИД'/)
  // Хаб сам не ходит за данными — только 4 плитки-ссылки.
  assert.doesNotMatch(hub, /fetchCurrentReports|fetchReportsKs|fetchReportsId/)

  assert.match(sections, /routes: \['\/reports', '\/reports-month', '\/reports-full', '\/reports-ks', '\/reports-id'\]/)
  assert.match(middleware, /'\/reports-month',/)
  assert.match(middleware, /'\/reports-full',/)
  assert.match(middleware, /'\/reports-ks',/)
  assert.match(middleware, /'\/reports-id',/)
  assert.match(middleware, /'\/reports-month': 'reports'/)
  assert.match(middleware, /'\/reports-full': 'reports'/)
  assert.match(middleware, /'\/reports-ks': 'reports'/)
  assert.match(middleware, /'\/reports-id': 'reports'/)
})

test('«Полный отчёт» — тот же лист, что «Отчёт месяца», другая тройка метрик', () => {
  // Одна и та же ручка /reports/current — дублировать запрос к мосту под
  // другую проекцию метрик незачем.
  assert.match(fullPage, /fetchCurrentReports/)
  assert.match(fullPage, /'ТП за месяц'/)
  assert.match(fullPage, /'Поступило'/)
  assert.match(fullPage, /'Отгружено'/)
  assert.doesNotMatch(fullPage, /'В цехе'/)
  // Та же группировка (Договор/Площадка/Заказчик), что у «Отчёта месяца».
  assert.match(fullPage, /groupReportRows/)
  assert.match(fullPage, /MODE_OPTIONS/)
})

test('GAS отдаёт «Поступило» той же ручкой reportsCurrent — не отдельным мостом', () => {
  assert.match(gas, /'Поступило за месяц, тн'/)
  assert.match(gas, /receivedTons: receivedIndex >= 0 \? reportsNumber_\(row\[receivedIndex\]\) : 0/)
})

test('«Поступило» — необязательная колонка: её отсутствие не роняет уже работающий Месячный отчёт', () => {
  // Четыре остальные колонки листа «Отчёты» обязательны (requireColumn_ —
  // падение с понятной ошибкой). «Поступило» — нет: заголовок не проверен
  // вживую, и до подтверждения он не должен иметь власть сломать
  // существующую фичу, которая этот столбец не использует.
  assert.match(gas, /const receivedIndex = header\.indexOf\('Поступило за месяц, тн'\)/)
  assert.doesNotMatch(gas, /requireColumn_\(header, 'Поступило за месяц, тн', 'Отчёты'\)/)
  assert.match(gas, /receivedAvailable: receivedIndex >= 0/)

  assert.match(reports, /'receivedAvailable' => \(bool\) \(\$source\['receivedAvailable'\] \?\? false\)/)
  assert.match(api, /receivedAvailable: boolean/)

  // «Полный отчёт» показывает явное «нет данных», а не тихий нуль.
  assert.match(fullPage, /receivedAvailable/)
  assert.match(fullPage, /formatReceived/)
  assert.match(fullPage, /'нет данных'/)
})

test('receivedTons — сквозное поле от GAS до клиента (мост его не отбрасывает)', () => {
  assert.match(reports, /'receivedTons' => erp_reports_number\(\$row\['receivedTons'\] \?\? 0\)/)
  assert.match(reports, /'receivedTons' => 0\.0,/)
  assert.match(api, /receivedTons: number/)
})

test('КС и ИД — свои GAS-действия, свои PHP-маршруты, право reports', () => {
  assert.match(gas, /action === 'reportsKs'/)
  assert.match(gas, /action === 'reportsId'/)
  assert.match(gas, /function reportsKs_\(token\)/)
  assert.match(gas, /function reportsId_\(token\)/)

  assert.match(router, /\$path === '\/reports\/ks'/)
  assert.match(router, /\$path === '\/reports\/id'/)
  assert.match(indexPhp, /erp_reports_ks_current\(\$pdo, \$config, \$requestId\)/)
  assert.match(indexPhp, /erp_reports_id_current\(\$pdo, \$config, \$requestId\)/)

  for (const handler of ['erp_reports_ks_current', 'erp_reports_id_current']) {
    const start = reports.indexOf(`function ${handler}(`)
    assert.ok(start > -1, `${handler} не найден`)
    const body = reports.slice(start, reports.indexOf('\n}\n', start) + 3)
    assert.match(body, /erp_require_permission\(\$pdo, \$actor, 'reports', \$requestId\)/)
  }
})

test('КС: договор/номер/сумма с НДС/статус, группировка по договору с «Итого»', () => {
  assert.match(gas, /requireColumn_\(header, 'Договор', 'КС'\)/)
  assert.match(gas, /requireColumn_\(header, '№', 'КС'\)/)
  assert.match(gas, /requireColumn_\(header, 'Сумма с НДС', 'КС'\)/)
  assert.match(gas, /requireColumn_\(header, 'Статус', 'КС'\)/)

  assert.match(reports, /function erp_reports_decode_ks_bridge/)
  assert.match(api, /export interface ErpKsRow/)
  assert.match(ksPage, /groupKsByContract/)
  assert.match(ksPage, /Итого/)
})

test('ИД: договор/статус/объём/сумма с НДС, группировка по договору', () => {
  assert.match(gas, /requireColumn_\(header, 'Договор', 'ИД'\)/)
  assert.match(gas, /requireColumn_\(header, 'Статус', 'ИД'\)/)
  assert.match(gas, /requireColumn_\(header, 'Объем', 'ИД'\)/)
  assert.match(gas, /requireColumn_\(header, 'Сумма с НДС', 'ИД'\)/)

  assert.match(reports, /function erp_reports_decode_id_bridge/)
  assert.match(api, /export interface ErpIdRow/)
  assert.match(idPage, /groupIdByContract/)
})
