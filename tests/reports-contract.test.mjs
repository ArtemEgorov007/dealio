import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const gas = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8')
const reports = await readFile(new URL('../public/api/src/Reports.php', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/reports.vue', import.meta.url), 'utf8')
const summary = await readFile(new URL('../app/components/erp/ErpReportsSummary.vue', import.meta.url), 'utf8').catch(() => '')
const table = await readFile(new URL('../app/components/erp/ErpReportsTable.vue', import.meta.url), 'utf8').catch(() => '')

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
