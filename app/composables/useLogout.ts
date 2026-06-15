import {account} from '@/utils/appwrite'
import {useAuthStore, useIsLoadingStore} from '~~/store/auth.store'
import {useCardSlideStore} from '~~/store/card-slide.store'
import {clearCardsCache} from '~/utils/cards-cache'
import {useQueryClient} from '@tanstack/vue-query'

export function useLogout() {
    const router = useRouter()
    const isLoadingStore = useIsLoadingStore()
    const authStore = useAuthStore()
    const cardSlideStore = useCardSlideStore()
    const queryClient = useQueryClient()

    const logout = async () => {
        try {
            isLoadingStore.set(true)

            if (!authStore.isGuest) {
                try {
                    await account.deleteSession('current')
                } catch {
                    // сессия могла уже отсутствовать
                }
            }

            cardSlideStore.clear()
            authStore.clear()
            clearCardsCache(queryClient)
            await router.push('/login')
        } finally {
            isLoadingStore.set(false)
        }
    }

    return {logout}
}
