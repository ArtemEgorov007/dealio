import type {EnumStatus} from '~~/types/cards.types'
import type {Priority} from '~~/store/board.store'

export interface ICard {
    id: string
    name: string
    price: number
    $createdAt: string
    category: string
    status: string
    priority: Priority
}

export interface IColumn {
    id: EnumStatus
    name: string
    items: ICard[]
}

export const CARDS_QUERY_KEY = 'cards'
export const CARDS_STATS_QUERY_KEY = 'cards-stats'

export type CardsQueryScope = 'guest' | `user-${string}`

export function getCardsQueryScope(isGuest: boolean, userId?: string): CardsQueryScope {
    if (isGuest) return 'guest'
    return `user-${userId ?? 'unknown'}`
}
