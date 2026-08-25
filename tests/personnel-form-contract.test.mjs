import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../app/pages/personnel.vue', import.meta.url), 'utf8')

test('personnel card connects save, create and dismissal operations', () => {
  assert.match(page, /ErpPersonnelForm/)
  assert.match(page, /savePersonnelEmployee/)
  assert.match(page, /createPersonnelEmployee/)
  assert.match(page, /dismissPersonnelEmployee/)
  assert.match(page, /Уволить/)
})
