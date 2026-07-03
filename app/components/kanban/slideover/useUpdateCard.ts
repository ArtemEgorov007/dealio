import {useMutation, useQueryClient} from '@tanstack/vue-query'

import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {updateCard as updateCardApi} from '~/utils/appwrite-cards'
import {isWishlistCategory, mapAppwriteError, validateWishlistPrice} from '~/utils/card-priority'
import {useAuthStore} from '~~/store/auth.store'
import {useBoardStore, type Priority} from '~~/store/board.store'
import {useCardSlideStore} from '~~/store/card-slide.store'
import type {EnumStatus} from '~~/types/cards.types'

export interface UpdateCardPayload {
    id: string
    name?: string
    category?: string
    price?: number
    status?: EnumStatus
    priority?: Priority
}

export function useUpdateCard() {
    const authStore = useAuthStore()
    const boardStore = useBoardStore()
    const slideStore = useCardSlideStore()
    const queryClient = useQueryClient()
    const {showSuccess, showError} = useAppToast()

    const invalidate = () => {
        queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
        queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
    }

    const patchSlideCard = (fields: Omit<UpdateCardPayload, 'id'>) => {
        if (!slideStore.card) return
        if (fields.name !== undefined) slideStore.card.name = fields.name
        if (fields.category !== undefined) slideStore.card.category = fields.category
        if (fields.price !== undefined) slideStore.card.price = fields.price
        if (fields.status !== undefined) slideStore.card.status = fields.status
        if (fields.priority !== undefined) slideStore.card.priority = fields.priority
    }

    return useMutation({
        mutationKey: ['update-card'],
        mutationFn: async (payload: UpdateCardPayload) => {
            const {id, ...fields} = payload

            if (fields.name !== undefined && !fields.name.trim()) {
                throw new Error('Название не может быть пустым')
            }

            if (fields.price !== undefined) {
                if (fields.price < 0) {
                    throw new Error('Стоимость не может быть отрицательной')
                }

                const category = fields.category ?? slideStore.card?.category
                if (!authStore.isGuest && isWishlistCategory(category)) {
                    const priceError = validateWishlistPrice(fields.price)
                    if (priceError) throw new Error(priceError)
                }
            }

            if (authStore.isGuest) {
                boardStore.updateCard(id, fields)
                return payload
            }

            try {
                await updateCardApi(id, {
                    name: fields.name?.trim(),
                    price: fields.price,
                    status: fields.status,
                    customerName: fields.category,
                })
            } catch (error) {
                throw new Error(mapAppwriteError(error, 'Не удалось сохранить изменения'))
            }

            return payload
        },
        onSuccess: (payload) => {
            const {id, ...fields} = payload
            patchSlideCard(fields)
            invalidate()
            showSuccess('Изменения сохранены')
        },
        onError: (error: unknown) => showError(error),
    })
}
