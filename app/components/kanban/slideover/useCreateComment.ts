import {useMutation} from '@tanstack/vue-query'
import {v4 as uuid} from 'uuid'
import {COLLECTION_COMMENTS, DB_ID} from '~~/app.constants'
import {isGuestSession} from '~~/store/auth.store'

export function useCreateComment({refetch}: { refetch: () => void }) {
    const store = useDealSlideStore()
    const commentRef = ref<string>()

    const {mutate} = useMutation({
        mutationKey: ['add comments', commentRef.value],
        mutationFn: () => {
            if (import.meta.client && isGuestSession()) {
                return Promise.resolve(null)
            }
            return DB.createDocument(DB_ID, COLLECTION_COMMENTS, uuid(), {
                text: commentRef.value,
                deal: store.card?.id,
            })
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
        if (!commentRef.value) return
        mutate()
    }

    return {
        writeComment,
        commentRef,
    }
}
