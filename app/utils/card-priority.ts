import {WISHLIST_CATEGORY, WISHLIST_CATEGORY_LABEL} from '~/components/kanban/kanban.labels'

/** Appwrite `deals.price`: integer 10_000–1_000_000. В UI — ₽ для желаний, иначе 0. */

export const APPWRITE_PRICE_MIN = 10_000
export const APPWRITE_PRICE_MAX = 1_000_000
export const APPWRITE_PRICE_SENTINEL = APPWRITE_PRICE_MIN

export function isWishlistCategory(category?: string): boolean {
    return category === WISHLIST_CATEGORY || category === WISHLIST_CATEGORY_LABEL
}

export function toAppwritePrice(price: number, category?: string): number {
    if (!isWishlistCategory(category)) {
        return APPWRITE_PRICE_SENTINEL
    }

    const value = Math.round(Number(price) || 0)
    if (value < APPWRITE_PRICE_MIN) return APPWRITE_PRICE_MIN
    if (value > APPWRITE_PRICE_MAX) return APPWRITE_PRICE_MAX
    return value
}

export function fromAppwritePrice(price: number, category?: string): number {
    if (!isWishlistCategory(category)) {
        return 0
    }

    return price
}

export function validateWishlistPrice(price: number): string | null {
    const value = Math.round(Number(price) || 0)
    if (value < APPWRITE_PRICE_MIN || value > APPWRITE_PRICE_MAX) {
        return `Стоимость для желаний: от ${APPWRITE_PRICE_MIN.toLocaleString('ru-RU')} до ${APPWRITE_PRICE_MAX.toLocaleString('ru-RU')} ₽`
    }
    return null
}

export function mapAppwriteError(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback

    const message = String((error as { message?: string }).message ?? '')

    if (/attribute "status"/i.test(message)) {
        return 'Не удалось сохранить колонку. Обновите страницу и попробуйте снова.'
    }

    if (/attribute "price"|invalid format.*price|10,000 and 1,000,000|10000.*1000000/i.test(message)) {
        return `Стоимость должна быть от ${APPWRITE_PRICE_MIN.toLocaleString('ru-RU')} до ${APPWRITE_PRICE_MAX.toLocaleString('ru-RU')} ₽`
    }

    if (/[а-яА-ЯёЁ]/.test(message)) {
        return message
    }

    return fallback
}
