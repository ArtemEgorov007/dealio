import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const canonicalPlugin = await readFile(new URL('../app/plugins/00.erp-canonical-origin.client.ts', import.meta.url), 'utf8').catch(() => '')
const store = await readFile(new URL('../store/erp-employee.store.ts', import.meta.url), 'utf8')
const loadProfileStart = store.indexOf('function loadProfile()')
const loadProfileEnd = store.indexOf('function saveProfile()', loadProfileStart)
const loadProfile = store.slice(loadProfileStart, loadProfileEnd)

test('ERP canonicalizes production aliases without redirecting staging hosts', () => {
  assert.match(canonicalPlugin, /const CANONICAL_ORIGIN = 'https:\/\/erp-mt\.ru'/)
  assert.match(canonicalPlugin, /PRODUCTION_HOSTS/)
  assert.match(canonicalPlugin, /PRODUCTION_HOSTS\.has\(location\.hostname\)/)
  assert.match(canonicalPlugin, /location\.replace\(/)
  assert.match(canonicalPlugin, /location\.pathname[\s\S]*location\.search[\s\S]*location\.hash/)
})

test('a valid stored ERP profile is migrated instead of being cleared after a profile-version bump', () => {
  assert.match(loadProfile, /JSON\.parse\(raw\)/)
  assert.match(loadProfile, /localStorage\.setItem\(VERSION_KEY, PROFILE_VERSION\)/)
  assert.doesNotMatch(loadProfile, /localStorage\.getItem\(VERSION_KEY\) !== PROFILE_VERSION[\s\S]*clearProfile\(\)/)
})
