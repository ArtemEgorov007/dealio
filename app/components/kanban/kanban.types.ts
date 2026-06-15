import type {EnumStatus} from '~~/types/cards.types'

export interface ICard {
    id: string
    name: string
    price: number
    $createdAt: string
    category: string
    status: string
}

export interface IColumn {
    id: EnumStatus
    name: string
    items: ICard[]
}

export const CARDS_QUERY_KEY = 'cards'
export const CARDS_STATS_QUERY_KEY = 'cards-stats'
