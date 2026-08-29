import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

// Модуль на TypeScript, а тесты гоняются голым node --test без сборки,
// поэтому берём реализацию из исходника: снимаем аннотации типов и
// экспортируем функции в изолированной области видимости. Так тест проверяет
// именно тот код, который уедет в бандл, а не его копию.
const source = await readFile(new URL('../app/utils/text-search.ts', import.meta.url), 'utf8')
const runnable = source
    .replace(/export function normalizeSearchText\(value: string\): string/, 'function normalizeSearchText(value)')
    .replace(/export function filterByQuery<T>\(items: T\[\], query: string, selector: \(item: T\) => string\): T\[\]/, 'function filterByQuery(items, query, selector)')

const {normalizeSearchText, filterByQuery} = new Function(
    `${runnable}; return {normalizeSearchText, filterByQuery}`,
)()

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
