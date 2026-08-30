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
 * Отбор элементов по подстроке запроса.
 *
 * Пустой запрос возвращает исходный список без копирования — списки складских
 * остатков доходят до сотен позиций, и лишний проход на каждый ввод символа
 * заметен на телефонах в цеху.
 */
export function filterByQuery<T>(items: T[], query: string, selector: (item: T) => string): T[] {
    const needle = normalizeSearchText(query)
    if (!needle) return items
    return items.filter(item => normalizeSearchText(selector(item)).includes(needle))
}
