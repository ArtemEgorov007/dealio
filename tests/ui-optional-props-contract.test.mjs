import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const searchBar = await readFile(new URL('../app/components/erp/ErpSearchBar.vue', import.meta.url), 'utf8')
const input = await readFile(new URL('../app/components/ui/input/Input.vue', import.meta.url), 'utf8')
const select = await readFile(new URL('../app/components/ui/select/Select.vue', import.meta.url), 'utf8')

test('optional UI props have explicit defaults without changing empty-string behavior', () => {
  for (const [component, defaults] of [
    [searchBar, {placeholder: 'Поиск', countLabel: ''}],
    [input, {label: '', placeholder: '', error: '', name: '', id: '', hint: '', rows: 0}],
    [select, {label: '', error: '', id: ''}],
  ]) {
    for (const [prop, value] of Object.entries(defaults)) {
      const literal = typeof value === 'string' ? `'${value}'` : String(value)
      assert.match(component, new RegExp(`${prop}:\\s*${literal}`))
    }
  }
})
