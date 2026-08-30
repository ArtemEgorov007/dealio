import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const bootstrap = await readFile(new URL('../app/plugins/erp-init.client.ts', import.meta.url), 'utf8')
const push = await readFile(new URL('../app/utils/erp-push.ts', import.meta.url), 'utf8')

test('a new ERP service worker safely refreshes only non-form report and approval pages', () => {
  assert.match(serviceWorker, /const ERP_RELEASE_ID = ['"][^'"]+['"]/)
  assert.match(serviceWorker, /self\.addEventListener\('install'/)
  assert.match(serviceWorker, /self\.skipWaiting\(\)/)
  assert.match(serviceWorker, /self\.addEventListener\('activate'/)
  assert.match(serviceWorker, /self\.clients\.claim\(\)/)
  assert.match(serviceWorker, /['"]\/reports['"]/, 'reports must be a safe reload target')
  assert.match(serviceWorker, /['"]\/approvals['"]/, 'approvals must be a safe reload target')
  assert.doesNotMatch(serviceWorker, /['"]\/personnel['"]/, 'personnel forms must never be force-reloaded')
  assert.match(serviceWorker, /searchParams\.set\(['"]erp-release['"]/)
  assert.match(serviceWorker, /client\.navigate\(/)
})

test('ERP registers its service worker at startup without requesting notification permission', () => {
  assert.match(push, /export async function registerErpServiceWorker\(\)/)
  assert.match(bootstrap, /registerErpServiceWorker/)
  assert.match(bootstrap, /\.catch\(\(\) => undefined\)/)
  assert.doesNotMatch(bootstrap, /Notification\.requestPermission/)
})
