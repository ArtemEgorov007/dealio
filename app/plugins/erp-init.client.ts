import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {registerErpServiceWorker} from '~/utils/erp-push'

export default defineNuxtPlugin(async () => {
    // Регистрация не запрашивает разрешение на уведомления. Она нужна всем
    // пользователям, чтобы PWA могла безопасно получать свежую оболочку.
    void registerErpServiceWorker().catch(() => undefined)

    const store = useErpEmployeeStore()
    store.init()
    await store.restoreSession()
})
