import assert from 'node:assert/strict'
import test from 'node:test'

import {getShiftCounterScope} from '../app/utils/shift-counter-scope.ts'

test('исполнитель видит в счётчике только свои записи за смену', () => {
    assert.deepEqual(getShiftCounterScope('Исполнитель', 'Иванов Иван'), {
        fio: 'Иванов Иван',
    })
})

test('менеджер видит в счётчике все записи за смену', () => {
    assert.deepEqual(getShiftCounterScope('Менеджер', 'Иванов Иван'), {})
})

test('неизвестная роль остаётся в безопасной персональной области', () => {
    assert.deepEqual(getShiftCounterScope('Стажёр', 'Иванов Иван'), {
        fio: 'Иванов Иван',
    })
})
