import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')
const start = source.indexOf('function generatePersonnelPassword_()')
const end = source.indexOf('\nfunction getJournalSheet_()', start)
const {generatePersonnelPassword_} = new Function(`${source.slice(start, end)}; return {generatePersonnelPassword_}`)()

test('generated personnel password has ten Latin characters with each required character class', () => {
  for (let index = 0; index < 100; index += 1) {
    const value = generatePersonnelPassword_()
    assert.equal(value.length, 10)
    assert.match(value, /^[A-Za-z0-9]+$/)
    assert.match(value, /[a-z]/)
    assert.match(value, /[A-Z]/)
    assert.match(value, /[0-9]/)
  }
})
