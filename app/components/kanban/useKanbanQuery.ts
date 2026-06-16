import {computed} from 'vue'
import {useQuery} from '@tanstack/vue-query'
import {KANBAN_DATA} from '~/components/kanban/kanban.data'
import type {ICardRecord} from '~~/types/cards.types'
import {
    CARDS_QUERY_KEY,
    getCardsQueryScope,
    type ICard,
    type IColumn,
} from '~/components/kanban/kanban.types'
import {useAuthStore} from '~~/store/auth.store'
import {listCards} from '~/utils/appwrite-cards'
import {fromAppwritePrice} from '~/utils/card-priority'
import {useBoardStore} from '~~/store/board.store'

export function useKanbanQuery() {
    const authStore = useAuthStore()
    const boardStore = useBoardStore()

    return useQuery({
        queryKey: computed(() => [CARDS_QUERY_KEY, getCardsQueryScope(authStore.isGuest, authStore.userId)]),
        queryFn: async () => {
            if (import.meta.client && authStore.isGuest) {
                boardStore.init()
                return boardStore.activeDocuments
            }
            try {
                return await listCards()
            } catch {
                throw new Error('Не удалось загрузить данные. Проверьте подключение и попробуйте снова.')
            }
        },
        select(data) {
            const newBoard: IColumn[] = JSON.parse(JSON.stringify(KANBAN_DATA))
            const records = data.documents as unknown as (ICardRecord & { priority?: string })[]

            for (const record of records) {
                const column = newBoard.find(col => col.id === record.status)
                if (!column) continue

                const category = record.customer?.name || 'Без категории'
                const card: ICard = {
                    $createdAt: record.$createdAt,
                    id: record.$id,
                    name: record.name,
                    price: fromAppwritePrice(record.price, category),
                    category,
                    status: column.id,
                    priority: (record.priority as ICard['priority']) ?? 'medium',
                }
                column.items.push(card)
            }

            newBoard.forEach(column => {
                column.items.sort((a, b) => {
                    const pOrder = {high: 0, medium: 1, low: 2}
                    const pDiff = pOrder[a.priority] - pOrder[b.priority]
                    if (pDiff !== 0) return pDiff
                    return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
                })
            })

            return newBoard
        },
        retry: 1,
        staleTime: 5 * 60 * 1000,
    })
}
