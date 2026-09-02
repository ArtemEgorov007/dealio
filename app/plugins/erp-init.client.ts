import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {registerErpPushSubscription, registerErpServiceWorker} from '~/utils/erp-push'

export default defineNuxtPlugin(async () => {
    // Регистрация не запрашивает разрешение на уведомления. Она нужна всем
    // пользователям, чтобы PWA могла безопасно получать свежую оболочку.
    void registerErpServiceWorker().catch(() => undefined)

    const store = useErpEmployeeStore()
    store.init()
    await store.restoreSession()

    // Восстанавливаем подписку при каждом входе, любому сотруднику.
    //
    // Подписка живёт не вечно: браузер меняет адрес доставки, push-сервис
    // отзывает протухший, человек переустанавливает приложение. Потеряв её
    // однажды, сотрудник замолкал навсегда — вернуть было нечем: подписка
    // заводилась только на экране согласований и только тем, кто утверждает
    // счета. Из-за этого рассылка «всем» доходила до троих.
    //
    // Разрешение здесь не спрашиваем — его запрашивает экран, по действию
    // человека. Если разрешение уже дано, подписку возвращаем молча.
    if (store.hasFio) {
        void registerErpPushSubscription().catch(() => undefined)
    }
})
