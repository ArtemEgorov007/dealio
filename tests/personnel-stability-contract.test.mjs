import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const hub = await readFile(new URL('../app/pages/register.vue', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/personnel.vue', import.meta.url), 'utf8')
const screen = await readFile(new URL('../app/components/erp/ErpScreen.vue', import.meta.url), 'utf8')
const table = await readFile(new URL('../app/components/erp/ErpPersonnelEmployeeTable.vue', import.meta.url), 'utf8')
const actionSheet = await readFile(new URL('../app/components/erp/ErpActionSheet.vue', import.meta.url), 'utf8')
const returnToDepartmentsStart = page.indexOf('const returnToDepartments = () =>')
const returnToDepartmentsEnd = page.indexOf('const openEmployee', returnToDepartmentsStart)
const returnToDepartments = page.slice(returnToDepartmentsStart, returnToDepartmentsEnd)

test('Personnel is an active hub tile without development copy', () => {
  const personnelTile = hub.match(/\{key: 'personnel',[^\n]+\}/)?.[0] ?? ''
  assert.doesNotMatch(personnelTile, /В разработке/)
  assert.match(personnelTile, /tone: '#016ED7'/)
})

test('Personnel back control invokes the department reset instead of routing to the same page', () => {
  assert.match(page, /onClick: returnToDepartments/)
  assert.match(screen, /shiftLink\.onClick/)
  assert.match(screen, /@click="shiftLink\.onClick"/)
  assert.match(returnToDepartments, /selectedDepartment\.value = ''/)
  assert.doesNotMatch(returnToDepartments, /loadDepartments\(\)/)
})

test('employee card sheet scrolls within the viewport while the page behind stays locked', () => {
  assert.match(actionSheet, /max-height: calc\(100dvh - env\(safe-area-inset-top, 0px\)\)/)
  assert.match(actionSheet, /overflow-y: auto/)
  assert.match(actionSheet, /document\.body\.style\.overflow = value \? 'hidden' : ''/)
})

test('employee rows visibly communicate that the card opens on click', () => {
  assert.match(table, /personnel-table__open/)
  assert.match(table, /Открыть/)
  assert.match(table, /heroicons:chevron-right/)
})
