import {defineStore} from 'pinia'
import {v4 as uuid} from 'uuid'

import type {ICard} from '../app/components/kanban/kanban.types'
import type {Priority} from './board.store'
import type {EnumStatus} from '../types/cards.types'

const AUTH_ARCHIVE_KEY = 'dealio-auth-archive'
const SETTINGS_STORAGE_KEY = 'dealio-settings'
const DEFAULT_RETENTION_DAYS = 30

export interface IAuthArchivedCard {
    id: string
    name: string
    price: number
    status: EnumStatus
    category: string
    priority: Priority
    $createdAt: string
    archivedAt: string
}

interface AuthArchiveBucket {
    cards: IAuthArchivedCard[]
}

type AuthArchiveStorage = Record<string, AuthArchiveBucket>

function loadRetentionDays(): number {
    if (typeof window === 'undefined') return DEFAULT_RETENTION_DAYS
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (!raw) return DEFAULT_RETENTION_DAYS
        return Number(JSON.parse(raw).retentionDays) || DEFAULT_RETENTION_DAYS
    } catch {
        return DEFAULT_RETENTION_DAYS
    }
}

function loadStorage(): AuthArchiveStorage {
    if (typeof window === 'undefined') return {}
    try {
        const raw = localStorage.getItem(AUTH_ARCHIVE_KEY)
        return raw ? JSON.parse(raw) as AuthArchiveStorage : {}
    } catch {
        return {}
    }
}

function saveStorage(data: AuthArchiveStorage): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(AUTH_ARCHIVE_KEY, JSON.stringify(data))
    } catch {
        // quota exceeded — ignore
    }
}

export const useAuthArchiveStore = defineStore('auth-archive', {
    state: () => ({
        userId: '' as string,
        cards: [] as IAuthArchivedCard[],
    }),

    getters: {
        archivedCards: (state): IAuthArchivedCard[] => state.cards,
    },

    actions: {
        init(userId?: string) {
            if (!userId || typeof window === 'undefined') return
            this.userId = userId
            const storage = loadStorage()
            this.cards = storage[userId]?.cards ?? []
            this.pruneExpired()
        },

        _persist() {
            if (!this.userId) return
            const storage = loadStorage()
            storage[this.userId] = {cards: this.cards}
            saveStorage(storage)
        },

        pruneExpired() {
            const retentionDays = loadRetentionDays()
            const cutoff = retentionDays * 24 * 60 * 60 * 1000
            const now = Date.now()
            const next = this.cards.filter(card =>
                now - new Date(card.archivedAt).getTime() < cutoff,
            )

            if (next.length !== this.cards.length) {
                this.cards = next
                this._persist()
            }
        },

        archiveFromCard(card: ICard) {
            this.cards.unshift({
                id: card.id,
                name: card.name,
                price: card.price,
                status: card.status as EnumStatus,
                category: card.category,
                priority: card.priority,
                $createdAt: card.$createdAt,
                archivedAt: new Date().toISOString(),
            })
            this._persist()
        },

        remove(id: string) {
            this.cards = this.cards.filter(card => card.id !== id)
            this._persist()
        },

        restore(card: IAuthArchivedCard) {
            if (this.cards.some(item => item.id === card.id)) return
            this.cards.unshift(card)
            this._persist()
        },

        takeForRestore(id: string): IAuthArchivedCard | null {
            const card = this.cards.find(item => item.id === id) ?? null
            if (!card) return null
            this.remove(id)
            return card
        },
    },
})

export function buildRestorePayload(card: IAuthArchivedCard) {
    return {
        documentId: uuid(),
        payload: {
            name: card.name,
            price: card.price,
            status: card.status,
            customer: {
                name: card.category,
                email: 'noreply@dealio.app',
            },
            comments: [] as [],
        },
    }
}
