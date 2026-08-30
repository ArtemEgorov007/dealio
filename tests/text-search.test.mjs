import assert from 'node:assert/strict'
import test from 'node:test'

import {loadTsModule} from './helpers/load-ts.mjs'

const {normalizeSearchText, filterByQuery, rankByQuery, resolveSingleMatch} =
    await loadTsModule(new URL('../app/utils/text-search.ts', import.meta.url))

test('нормализация приводит регистр, схлопывает пробелы и обрезает края', () => {
    assert.equal(normalizeSearchText('  Маркер   Р-11  СИНИЙ '), 'маркер р-11 синий')
    assert.equal(normalizeSearchText('Диск\tшлифовальный\nР40'), 'диск шлифовальный р40')
    assert.equal(normalizeSearchText(''), '')
})

test('пустой запрос возвращает исходный список тем же объектом', () => {
    const items = [{name: 'Маркер'}, {name: 'Диск'}]
    const result = filterByQuery(items, '   ', item => item.name)

    assert.equal(result, items, 'при пустом запросе список не должен копироваться')
})

test('поиск не зависит от регистра и лишних пробелов', () => {
    const items = [{name: 'Маркер р-11 синий'}, {name: 'Диск шлифовальный Р40'}]

    assert.deepEqual(filterByQuery(items, 'МАРКЕР', item => item.name), [items[0]])
    assert.deepEqual(filterByQuery(items, '  р-11   ', item => item.name), [items[0]])
    assert.deepEqual(filterByQuery(items, 'р40', item => item.name), [items[1]])
})

test('поиск идёт по подстроке в середине названия', () => {
    const items = [{name: 'Круг отрезной 125 мм х 2 мм'}]

    assert.deepEqual(filterByQuery(items, 'отрезной', item => item.name), items)
    assert.deepEqual(filterByQuery(items, 'нет такого', item => item.name), [])
})

test('работает со списком простых строк через selector', () => {
    const items = ['Термобирки', 'Техническая плёнка']

    assert.deepEqual(filterByQuery(items, 'терм', value => value), ['Термобирки'])
})

test('слова ищутся независимо и в любом порядке', () => {
    // «Защитная каска» раньше не находила «Каска защитная», и сотрудник
    // решал, что позиции в номенклатуре нет.
    const items = [{name: 'Каска защитная'}, {name: 'Перчатки х/б'}, {name: 'Круг отрезной 125'}]
    const pick = query => filterByQuery(items, query, i => i.name).map(i => i.name)

    assert.deepEqual(pick('защитная каска'), ['Каска защитная'])
    assert.deepEqual(pick('каска защ'), ['Каска защитная'])
    assert.deepEqual(pick('125 круг'), ['Круг отрезной 125'])
    assert.deepEqual(pick('каска перчатки'), [])
})

test('совпадения с начала названия идут первыми', () => {
    // Сотрудник почти всегда набирает начало названия.
    const items = [{name: 'Щётка по кругу'}, {name: 'Круг отрезной 230'}, {name: 'Круг отрезной 125'}]
    assert.deepEqual(
        rankByQuery(items, 'круг', i => i.name).map(i => i.name),
        ['Круг отрезной 125', 'Круг отрезной 230', 'Щётка по кругу'],
    )
})

test('пустой запрос в ранжировании отдаёт весь список', () => {
    const items = [{name: 'Каска защитная'}, {name: 'Перчатки х/б'}]
    assert.equal(rankByQuery(items, '', i => i.name).length, 2)
})

test('единственное совпадение подбирается за пользователя', () => {
    const items = [{name: 'Каска защитная'}, {name: 'Круг отрезной 125'}, {name: 'Круг отрезной 230'}]
    const resolve = query => resolveSingleMatch(items, query, i => i.name)?.name ?? null

    assert.equal(resolve('каска защитная'), 'Каска защитная', 'точное совпадение без учёта регистра')
    assert.equal(resolve('  КАСКА   ЗАЩИТНАЯ '), 'Каска защитная', 'лишние пробелы не мешают')
    assert.equal(resolve('каска'), 'Каска защитная', 'единственное подходящее')
    assert.equal(resolve('защитная каска'), 'Каска защитная', 'порядок слов не важен')
})

test('между двумя похожими позициями не угадываем', () => {
    // «Круг отрезной 125» и «Круг отрезной 230» — разные вещи, подставить
    // одну вместо другой хуже, чем попросить выбрать.
    const items = [{name: 'Круг отрезной 125'}, {name: 'Круг отрезной 230'}]
    assert.equal(resolveSingleMatch(items, 'круг', i => i.name), null)
    assert.equal(resolveSingleMatch(items, 'круг отрезной', i => i.name), null)
    assert.equal(resolveSingleMatch(items, '', i => i.name), null)
    assert.equal(resolveSingleMatch(items, 'болт', i => i.name), null)
})
