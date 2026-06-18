import {useMutation, useQueryClient} from '@tanstack/vue-query'
import {v4 as uuid} from 'uuid'
import {isGuestSession} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {createComment} from '~/utils/appwrite-comments'

export function useCreateComment({refetch}: { refetch: () => void }) {
    const store = useCardSlideStore()
    const boardStore = useBoardStore()
    const queryClient = useQueryClient()
    const {showError} = useAppToast()
    const commentRef = ref<string>('')

    const {mutate} = useMutation({
        mutationKey: ['add-comment'],
        mutationFn: () => {
            if (import.meta.client && isGuestSession()) {
                return Promise.resolve({
                    $id: uuid(),
                    $createdAt: new Date().toISOString(),
                    text: commentRef.value.trim(),
                })
            }
            if (!store.card?.id) {
                throw new Error('Элемент не выбран')
            }
            return createComment(commentRef.value.trim(), store.card.id)
        },
        onSuccess: (result) => {
            if (import.meta.client && isGuestSession() && result && store.card?.id) {
                boardStore.addComment(store.card.id, result as { $id: string; $createdAt: string; text: string })
                queryClient.invalidateQueries({queryKey: ['card', store.card.id]})
                commentRef.value = ''
                return
            }
            refetch()
            commentRef.value = ''
        },
        onError: showError,
    })

    const writeComment = () => {
        if (!commentRef.value?.trim()) return
        mutate()
    }

    return {
        writeComment,
        commentRef,
    }
}
