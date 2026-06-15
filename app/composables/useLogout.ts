import {account} from '@/utils/appwrite'
import {useAuthStore, useIsLoadingStore} from '~~/store/auth.store'
import {useCardSlideStore} from '~~/store/card-slide.store'

export function useLogout() {
    const router = useRouter()
    const isLoadingStore = useIsLoadingStore()
    const authStore = useAuthStore()
    const cardSlideStore = useCardSlideStore()

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
            await router.push('/login')
        } finally {
            isLoadingStore.set(false)
        }
    }

    return {logout}
}
