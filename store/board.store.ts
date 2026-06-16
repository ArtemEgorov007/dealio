import { defineStore } from 'pinia'
import { MOCK_CARDS } from '../app/components/kanban/kanban.mock'
import type { ICardRecord } from '../types/cards.types'
import { EnumStatus } from '../types/cards.types'

export type Priority = 'low' | 'medium' | 'high'

export interface IBoardCard extends ICardRecord {
    priority: Priority
    archived: boolean
    archivedAt?: string
}

const BOARD_STORAGE_KEY = 'dealio-board'
const SETTINGS_STORAGE_KEY = 'dealio-settings'
const DEFAULT_RETENTION_DAYS = 30

function seedFromMock(): IBoardCard[] {
    const priorities: Priority[] = ['high', 'medium', 'medium', 'low', 'high', 'medium', 'low', 'medium', 'medium', 'high', 'low']
    return MOCK_CARDS.map((card, i) => ({
        ...card,
        priority: priorities[i] ?? 'medium',
        archived: false,
        archivedAt: undefined,
    }))
}

function loadFromStorage(): IBoardCard[] | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem(BOARD_STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as IBoardCard[]
    } catch {
        return null
    }
}

function saveToStorage(cards: IBoardCard[]): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(cards))
    } catch {
        // quota exceeded — ignore
    }
}

function loadRetentionDays(): number {
    if (typeof window === 'undefined') return DEFAULT_RETENTION_DAYS
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (!raw) return DEFAULT_RETENTION_DAYS
        const parsed = JSON.parse(raw)
        return Number(parsed.retentionDays) || DEFAULT_RETENTION_DAYS
    } catch {
        return DEFAULT_RETENTION_DAYS
    }
}

export interface IBoardState {
    cards: IBoardCard[]
    retentionDays: number
}

export const useBoardStore = defineStore('board', {
    state: (): IBoardState => ({
        cards: [],
        retentionDays: DEFAULT_RETENTION_DAYS,
    }),

    getters: {
        activeCards: (state): IBoardCard[] =>
            state.cards.filter(c => !c.archived),

        archivedCards: (state): IBoardCard[] =>
            state.cards.filter(c => c.archived),

        activeDocuments(): { documents: IBoardCard[]; total: number } {
            const cards = this.activeCards
            return { documents: cards, total: cards.length }
        },
    },

    actions: {
        init() {
            if (typeof window === 'undefined') return
            this.retentionDays = loadRetentionDays()
            const stored = loadFromStorage()
            if (stored && stored.length > 0) {
                this.cards = stored
            } else {
                this.cards = seedFromMock()
                saveToStorage(this.cards)
            }
            this._pruneExpired()
        },

        _persist() {
            saveToStorage(this.cards)
        },

        _pruneExpired() {
            const now = Date.now()
            const cutoff = this.retentionDays * 24 * 60 * 60 * 1000
            this.cards = this.cards.filter(c => {
                if (!c.archived || !c.archivedAt) return true
                return now - new Date(c.archivedAt).getTime() < cutoff
            })
            this._persist()
        },

        setRetentionDays(days: number) {
            this.retentionDays = days
            if (typeof window !== 'undefined') {
                try {
                    const existing = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')
                    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...existing, retentionDays: days }))
                } catch {
                    // quota exceeded — ignore
                }
            }
            this._pruneExpired()
        },

        addCard(card: IBoardCard) {
            this.cards.unshift(card)
            this._persist()
        },

        updateCardStatus(id: string, status: EnumStatus) {
            const card = this.cards.find(c => c.$id === id)
            if (card) {
                card.status = status
                this._persist()
            }
        },

        updateCardPriority(id: string, priority: Priority) {
            const card = this.cards.find(c => c.$id === id)
            if (card) {
                card.priority = priority
                this._persist()
            }
        },

        addComment(cardId: string, comment: { $id: string; $createdAt: string; text: string }) {
            const card = this.cards.find(c => c.$id === cardId)
            if (card) {
                card.comments = [...card.comments, comment]
                this._persist()
            }
        },

        archiveCard(id: string) {
            const card = this.cards.find(c => c.$id === id)
            if (card) {
                card.archived = true
                card.archivedAt = new Date().toISOString()
                this._persist()
            }
        },

        restoreCard(id: string) {
            const card = this.cards.find(c => c.$id === id)
            if (card) {
                card.archived = false
                card.archivedAt = undefined
                this._persist()
            }
        },

        deleteCardPermanently(id: string) {
            this.cards = this.cards.filter(c => c.$id !== id)
            this._persist()
        },

        pruneExpired() {
            this._pruneExpired()
        },
    },
})
