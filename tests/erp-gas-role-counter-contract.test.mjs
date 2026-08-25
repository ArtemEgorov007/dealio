import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../scripts/erp-gas-webapp.js', import.meta.url), 'utf8')

test('GAS читает роль из таблицы доступа и отдаёт её после входа', () => {
    assert.match(source, /const roleIndex = header\.indexOf\('Роль'\)/)
    assert.match(source, /role: strAt\(roleIndex\)/)
})

test('GAS не фильтрует записи по ФИО, когда счётчик запрошен для менеджера', () => {
    assert.match(source, /if \(fioNormalized && normalizeCell_\(row\[engineerIndex\]\) !== fioNormalized\) continue/g)
})
