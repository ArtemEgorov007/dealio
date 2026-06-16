import {useMutation} from '@tanstack/vue-query'
import {isGuestSession} from '~~/store/auth.store'
import {createComment} from '~/utils/appwrite-comments'

export function useCreateComment({refetch}: { refetch: () => void }) {
    const store = useCardSlideStore()
    const commentRef = ref<string>('')

    const {mutate} = useMutation({
        mutationKey: ['add-comment'],
        mutationFn: () => {
            if (import.meta.client && isGuestSession()) {
                return Promise.resolve(null)
            }
            if (!store.card?.id) {
                throw new Error('Элемент не выбран')
            }
            return createComment(commentRef.value.trim(), store.card.id)
        },
        onSuccess: () => {
            if (import.meta.client && isGuestSession()) {
                commentRef.value = ''
                return
            }
            refetch()
            commentRef.value = ''
        },
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
