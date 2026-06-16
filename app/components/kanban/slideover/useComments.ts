import {computed} from 'vue'
import {useQuery} from '@tanstack/vue-query'
import {COLLECTION_CARDS, DB_ID} from '~~/app.constants'
import {DB} from '~/utils/appwrite'
import {getCardsQueryScope} from '~/components/kanban/kanban.types'
import {useAuthStore} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'

export function useComments() {
    const store = useCardSlideStore()
    const authStore = useAuthStore()
    const boardStore = useBoardStore()
    const cardId = store.card?.id || ''

    return useQuery({
        queryKey: computed(() => ['card', cardId, getCardsQueryScope(authStore.isGuest, authStore.userId)]),
        queryFn: () => {
            if (import.meta.client && authStore.isGuest) {
                return boardStore.cards.find(c => c.$id === cardId) ?? null
            }
            return DB.getDocument(DB_ID, COLLECTION_CARDS, cardId)
        },
    })
}
