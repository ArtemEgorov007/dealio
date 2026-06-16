import {computed} from 'vue'
import {useQuery} from '@tanstack/vue-query'
import {COLLECTION_CARDS, DB_ID} from '~~/app.constants'
import {DB} from '~/utils/appwrite'
import {getCardsQueryScope} from '~/components/kanban/kanban.types'
import {useAuthStore} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {useCardSlideStore} from '~~/store/card-slide.store'

export function useComments() {
    const slideStore = useCardSlideStore()
    const authStore = useAuthStore()
    const boardStore = useBoardStore()
    const cardId = computed(() => slideStore.card?.id ?? '')

    return useQuery({
        queryKey: computed(() => ['card', cardId.value, getCardsQueryScope(authStore.isGuest, authStore.userId)]),
        enabled: computed(() => slideStore.isOpen && !!cardId.value),
        staleTime: 60_000,
        queryFn: () => {
            if (import.meta.client && authStore.isGuest) {
                return boardStore.cards.find(card => card.$id === cardId.value) ?? null
            }
            return DB.getDocument(DB_ID, COLLECTION_CARDS, cardId.value)
        },
    })
}
