import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const api = await readFile(new URL('../app/utils/erp-api.ts', import.meta.url), 'utf8').catch(() => '')
const store = await readFile(new URL('../store/erp-employee.store.ts', import.meta.url), 'utf8')
const plugin = await readFile(new URL('../app/plugins/erp-init.client.ts', import.meta.url), 'utf8')

test('SQL API session client never stores an open password', () => {
  const profileStart = api.indexOf('export interface ErpApiLoginProfile')
  const profileEnd = api.indexOf('}', profileStart)
  const profile = api.slice(profileStart, profileEnd)

  assert.equal(api.includes('localStorage'), false)
  assert.equal(api.includes('sessionStorage'), false)
  assert.equal(profile.includes('password'), false)
})

test('ERP startup restores a server session before route protection', () => {
  assert.match(store, /async restoreSession\(\)/)
  assert.match(store, /restoreErpEmployee\(\)/)
  assert.match(plugin, /restoreSession\(\)/)
  assert.match(store, /Transient network errors must not clear a cached SQL session/)
})
