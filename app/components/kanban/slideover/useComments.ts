import {useQuery} from '@tanstack/vue-query'
import {COLLECTION_CARDS, DB_ID} from '~~/app.constants'
import {MOCK_CARDS} from '~/components/kanban/kanban.mock'
import {isGuestSession} from '~~/store/auth.store'

export function useComments() {
    const store = useCardSlideStore()
    const cardId = store.card?.id || ''

    return useQuery({
        queryKey: ['card', cardId],
        queryFn: () => {
            if (import.meta.client && isGuestSession()) {
                return MOCK_CARDS.find(record => record.$id === cardId) ?? null
            }
            return DB.getDocument(DB_ID, COLLECTION_CARDS, cardId)
        },
    })
}
