import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')

test('personnel endpoints require staff-management access and handle dynamic rights', () => {
  for (const action of [
    'personnelDepartments',
    'personnelEmployees',
    'personnelEmployee',
    'personnelSave',
    'personnelCreate',
    'personnelDismiss',
  ]) {
    assert.match(source, new RegExp(`payload\\.action === '${action}'`))
  }

  assert.match(source, /header\.indexOf\('Управление кадрами'\)/)
  assert.match(source, /getSheetByName\('Площадки'\)/)
  assert.match(source, /slice\(10\)/)
  assert.match(source, /'Уволен'/)
  assert.match(source, /LockService\.getScriptLock\(\)/)
})
