import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const config = await readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8')
const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8').catch(() => '')
const sheets = await readFile(new URL('../app/utils/erp-sheets.ts', import.meta.url), 'utf8')
const push = await readFile(new URL('../app/utils/erp-push.ts', import.meta.url), 'utf8')
const router = await readFile(new URL('../public/api/src/Router.php', import.meta.url), 'utf8')

test('ERP exposes an explicit SQL API mode with a same-origin default', () => {
  assert.match(config, /erpBackendMode: process\.env\.NUXT_PUBLIC_ERP_BACKEND_MODE \|\| 'gas'/)
  assert.match(config, /erpApiBase: process\.env\.NUXT_PUBLIC_ERP_API_BASE \|\| '\/api'/)
})

test('SQL API client always sends authenticated same-origin requests', () => {
  assert.match(api, /export function getErpBackendMode\(\): 'gas' \| 'sql'/)
  assert.match(api, /export async function erpApiRequest/)
  assert.match(api, /credentials: 'include'/)
  assert.match(api, /'Content-Type': 'application\/json'/)
  assert.match(api, /ERP_API_TIMEOUT_MS\s*=\s*12_000/)
  assert.match(api, /new AbortController\(\)/)
  assert.match(api, /signal: controller\.signal/)
})

test('ERP transport selects the SQL API without deleting the GAS rollback adapter', () => {
  assert.match(sheets, /getErpBackendMode\(\) === 'sql'/)
  assert.match(sheets, /loginErpEmployeeViaApi/)
  assert.match(sheets, /requestGasPost/)
  assert.match(sheets, /fetchWorkshopBadgesViaApi/)
  assert.match(sheets, /issueBadgeViaApi/)
  assert.match(sheets, /fetchIssuedBadgesTodayViaApi/)
  assert.match(sheets, /deleteIssuedBadgeViaApi/)
  assert.match(sheets, /recordHandoverViaApi/)
  assert.match(sheets, /fetchHandedOverTodayViaApi/)
  assert.match(sheets, /undoHandoverViaApi/)
})

test('SQL API client exposes badges endpoints', () => {
  assert.match(api, /export async function fetchWorkshopBadgesViaApi/)
  assert.match(api, /export async function issueBadgeViaApi/)
  assert.match(api, /export async function fetchIssuedBadgesTodayViaApi/)
  assert.match(api, /export async function deleteIssuedBadgeViaApi/)
  assert.match(api, /badges\/issues/)
})

test('SQL API client exposes handover endpoints', () => {
  assert.match(api, /export async function recordHandoverViaApi/)
  assert.match(api, /export async function fetchHandedOverTodayViaApi/)
  assert.match(api, /export async function undoHandoverViaApi/)
  assert.match(api, /handover\/entries/)
})

test('SQL API client exposes approvals endpoints', () => {
  assert.match(api, /export interface ErpApproval/)
  assert.match(api, /export async function fetchApprovalsViaApi/)
  assert.match(api, /export async function decideApprovalViaApi/)
  assert.match(api, /approvals\/decisions/)
  assert.match(sheets, /fetchApprovals\(/)
  assert.match(sheets, /decideApproval\(/)
})

test('SQL API client exposes push subscription endpoints', () => {
  assert.match(push, /push\/vapid-key/)
  assert.match(push, /push\/subscribe/)
  assert.match(router, /push_vapid_key/)
  assert.match(router, /push_subscribe/)
  assert.match(router, /push_notify_cron/)
})
