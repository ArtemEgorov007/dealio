import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../app/pages/personnel.vue', import.meta.url), 'utf8')
const table = await readFile(new URL('../app/components/erp/ErpPersonnelEmployeeTable.vue', import.meta.url), 'utf8')

test('personnel page loads department tiles and employee table', () => {
  assert.match(page, /fetchPersonnelDepartments/)
  assert.match(page, /fetchPersonnelEmployees/)
  assert.match(page, /ErpPersonnelDepartmentTile/)
  assert.match(page, /ErpPersonnelEmployeeTable/)
  assert.match(page, /Добавить сотрудника/)
  assert.match(table, /Должность/)
  assert.match(table, /ФИО/)
})
