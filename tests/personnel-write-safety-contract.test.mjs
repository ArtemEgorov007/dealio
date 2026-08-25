import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const gas = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/personnel.vue', import.meta.url), 'utf8')
const store = await readFile(new URL('../store/erp-employee.store.ts', import.meta.url), 'utf8')

test('personnel writes protect Sheets cells from formula execution', () => {
  assert.match(gas, /function toSheetLiteral_\(value\)/)
  assert.match(gas, /setValue\(toSheetLiteral_\(value\)\)/)
  assert.match(gas, /row\[context\.schema\.fioIndex\] = toSheetLiteral_\(fio\)/)
})

test('changing own personnel password refreshes the stored actor credentials', () => {
  assert.match(page, /employeeStore\.updatePassword\(draft\.password\)/)
  assert.match(store, /updatePassword\(password: string\)/)
})
