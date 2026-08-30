/**
 * Нормализация строк для поиска по спискам ERP.
 *
 * Один и тот же приём («в нижний регистр, схлопнуть пробелы, обрезать края»)
 * был скопирован в warehouse-issue, warehouse-receive, warehouse-balance и
 * badges. Любая правка поведения поиска требовала синхронной правки в четырёх
 * местах, поэтому вынесено в общий модуль.
 */
export function normalizeSearchText(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Отбор элементов по запросу: подходит тот, где встретилось каждое слово.
 *
 * Раньше запрос искался целой подстрокой, и «защитная каска» не находила
 * «Каска защитная» — сотрудник видел пустой список и решал, что позиции в
 * номенклатуре нет. Слова сверяются независимо и в любом порядке.
 *
 * Пустой запрос возвращает исходный список без копирования — списки складских
 * остатков доходят до сотен позиций, и лишний проход на каждый ввод символа
 * заметен на телефонах в цеху.
 */
export function filterByQuery<T>(items: T[], query: string, selector: (item: T) => string): T[] {
    const needle = normalizeSearchText(query)
    if (!needle) return items
    const words = needle.split(' ')
    return items.filter(item => {
        const haystack = normalizeSearchText(selector(item))
        return words.every(word => haystack.includes(word))
    })
}

/**
 * То же, что filterByQuery, но совпадения с начала названия идут первыми.
 *
 * При вводе «круг» позиция «Круг отрезной 125» полезнее, чем «Щётка по кругу»:
 * сотрудник почти всегда набирает начало названия.
 */
export function rankByQuery<T>(items: T[], query: string, selector: (item: T) => string): T[] {
    const needle = normalizeSearchText(query)
    const found = filterByQuery(items, query, selector)
    if (!needle) return found

    return [...found].sort((a, b) => {
        const left = normalizeSearchText(selector(a))
        const right = normalizeSearchText(selector(b))
        const leftRank = left === needle ? 0 : left.startsWith(needle) ? 1 : 2
        const rightRank = right === needle ? 0 : right.startsWith(needle) ? 1 : 2
        if (leftRank !== rightRank) return leftRank - rightRank
        return left.localeCompare(right, 'ru')
    })
}

/**
 * Единственное совпадение запроса — то, что сотрудник имел в виду.
 *
 * Возвращает элемент, если запрос совпал с названием точно (без учёта
 * регистра) или если во всей номенклатуре нашёлся ровно один подходящий.
 * Иначе null: угадывать между двумя похожими позициями ТМЦ нельзя,
 * «Круг отрезной 125» и «Круг отрезной 230» — разные вещи.
 */
export function resolveSingleMatch<T>(items: T[], query: string, selector: (item: T) => string): T | null {
    const needle = normalizeSearchText(query)
    if (!needle) return null

    const exact = items.find(item => normalizeSearchText(selector(item)) === needle)
    if (exact) return exact

    const found = filterByQuery(items, query, selector)
    return found.length === 1 ? found[0]! : null
}
