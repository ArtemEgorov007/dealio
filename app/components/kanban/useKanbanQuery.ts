import {useQuery} from '@tanstack/vue-query'
import {KANBAN_DATA} from '~/components/kanban/kanban.data'
import {MOCK_CARDS} from '~/components/kanban/kanban.mock'
import type {ICardRecord} from '~~/types/cards.types'
import {CARDS_QUERY_KEY, type ICard, type IColumn} from '~/components/kanban/kanban.types'
import {isGuestSession} from '~~/store/auth.store'
import {listCards} from '~/utils/appwrite-cards'

export function useKanbanQuery() {
    return useQuery({
        queryKey: [CARDS_QUERY_KEY],
        queryFn: async () => {
            if (import.meta.client && isGuestSession()) {
                return {documents: MOCK_CARDS, total: MOCK_CARDS.length}
            }
            try {
                return await listCards()
            } catch {
                throw new Error('Не удалось загрузить данные. Проверьте подключение и попробуйте снова.')
            }
        },
        select(data) {
            const newBoard: IColumn[] = JSON.parse(JSON.stringify(KANBAN_DATA))
            const records = data.documents as unknown as ICardRecord[]

            for (const record of records) {
                const column = newBoard.find(col => col.id === record.status)
                if (!column) continue

                const card: ICard = {
                    $createdAt: record.$createdAt,
                    id: record.$id,
                    name: record.name,
                    price: record.price,
                    category: record.customer?.name || 'Без категории',
                    status: column.id,
                }
                column.items.push(card)
            }

            newBoard.forEach(column => {
                column.items.sort((a, b) =>
                    new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
                )
            })

            return newBoard
        },
        retry: 1,
        staleTime: 5 * 60 * 1000,
    })
}
