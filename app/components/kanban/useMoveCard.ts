import {useMutation, useQueryClient} from '@tanstack/vue-query'

import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {isGuestSession} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {updateCardStatus} from '~/utils/appwrite-cards'
import type {EnumStatus} from '~~/types/cards.types'

export function useMoveCard(onMoved?: () => void) {
    const queryClient = useQueryClient()
    const boardStore = useBoardStore()
    const {showError} = useAppToast()

    const {mutate, isPending, variables} = useMutation({
        mutationKey: ['move-card'],
        mutationFn: ({docId, status}: { docId: string; status: EnumStatus }) => {
            if (import.meta.client && isGuestSession()) {
                return Promise.resolve({docId, status})
            }
            return updateCardStatus(docId, status)
        },
        onSuccess: (_, mutationVariables) => {
            if (import.meta.client && isGuestSession()) {
                boardStore.updateCardStatus(mutationVariables.docId, mutationVariables.status)
                queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
                queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
                onMoved?.()
                return
            }
            queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
            onMoved?.()
        },
        onError: showError,
    })

    return {moveCard: mutate, isMoving: isPending, movingToStatus: variables}
}
