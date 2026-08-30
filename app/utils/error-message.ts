/**
 * Достаёт текст ошибки для показа пользователю.
 *
 * Связка «instanceof Error — взять message, иначе запасной текст» повторялась
 * в 18 местах — страницы, компоненты, сторы и композаблы. Общий помощник даёт
 * единственную точку, где можно улучшить разбор (сейчас, например, ошибка
 * из GAS, прилетевшая строкой, теряла текст и подменялась запасным).
 *
 * @param error   то, что поймал catch — тип не гарантирован
 * @param fallback текст, если из ошибки ничего осмысленного не достать
 */
export function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) return error.message

    // fetch/GAS иногда отклоняет промис голой строкой, а не Error.
    if (typeof error === 'string' && error.trim()) return error

    // Объект с полем message, но не наследник Error (частый случай в JSON-ответах).
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as {message: unknown}).message
        if (typeof message === 'string' && message.trim()) return message
    }

    return fallback
}
