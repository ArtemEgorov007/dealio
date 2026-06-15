import {useQuery} from '@tanstack/vue-query'
import {COLLECTION_DEALS, DB_ID} from '~~/app.constants'
import {MOCK_DEALS} from '~/components/kanban/kanban.mock'
import {isGuestSession} from '~~/store/auth.store'

export function useComments() {
    const store = useDealSlideStore()
    const cardId = store.card?.id || ''

    return useQuery({
        queryKey: ['deal', cardId],
        queryFn: () => {
            if (import.meta.client && isGuestSession()) {
                const mockDeal = MOCK_DEALS.find(d => d.$id === cardId) ?? null
                return Promise.resolve(mockDeal as any)
            }
            return DB.getDocument(DB_ID, COLLECTION_DEALS, cardId)
        },
    })
}
