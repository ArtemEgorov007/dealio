import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/utils/erp-sheets.ts', import.meta.url), 'utf8')

test('personnel client sends every personnel action through authenticated POST', () => {
  for (const name of [
    'fetchPersonnelDepartments',
    'fetchPersonnelEmployees',
    'fetchPersonnelEmployee',
    'savePersonnelEmployee',
    'createPersonnelEmployee',
    'dismissPersonnelEmployee',
  ]) {
    assert.match(source, new RegExp(`export async function ${name}`))
  }

  assert.match(source, /actorLogin: actor\.login/)
  assert.match(source, /actorPassword: actor\.password/)
  assert.match(source, /requestPersonnel\(config, 'personnelDepartments', actor\)/)
  assert.match(source, /requestGasPost\(config, payload\)/)
})
