import {useMutation, useQueryClient} from '@tanstack/vue-query'

import type {ICard} from '~/components/kanban/kanban.types'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {deleteCard} from '~/utils/appwrite-cards'
import {mapAppwriteError} from '~/utils/card-priority'
import {useAuthArchiveStore} from '~~/store/auth-archive.store'
import {useAuthStore} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'

export function useArchiveCard() {
    const authStore = useAuthStore()
    const boardStore = useBoardStore()
    const authArchiveStore = useAuthArchiveStore()
    const queryClient = useQueryClient()
    const toast = useMutationToast('Карточка отправлена в архив')

    const invalidate = () => {
        queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
        queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
    }

    return useMutation({
        mutationKey: ['archive-card'],
        mutationFn: async (card: ICard) => {
            if (authStore.isGuest) {
                boardStore.archiveCard(card.id)
                return
            }

            if (!authStore.userId) {
                throw new Error('Нужно войти в аккаунт')
            }

            authArchiveStore.init(authStore.userId)

            try {
                await deleteCard(card.id)
            } catch (error) {
                throw new Error(mapAppwriteError(error, 'Не удалось отправить карточку в архив'), {cause: error})
            }

            authArchiveStore.archiveFromCard(card)
        },
        onSuccess: () => {
            toast.onSuccess()
            invalidate()
        },
        onError: toast.onError,
    })
}
