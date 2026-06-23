import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useCrmSessionStore} from '~~/store/crm-session.store'

const CRM_ROUTES = new Set([
    '/register',
    '/workshop',
    '/badges',
    '/receipt',
    '/shift',
    '/scan-qr',
])

const DEALIO_PREFIXES = ['/board', '/login', '/archive', '/settings', '/dashboard', '/ideas', '/tasks', '/wishlist', '/help']

export default defineNuxtRouteMiddleware((to) => {
    // GitHub Pages добавляет конечный слэш при прямой навигации/обновлении страницы
    // (например /badges/) — без нормализации сравнения ниже не сработают.
    const path = to.path.length > 1 ? to.path.replace(/\/$/, '') : to.path

    if (DEALIO_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
        return
    }

    const employeeStore = useCrmEmployeeStore()
    const sessionStore = useCrmSessionStore()

    if (import.meta.client) {
        employeeStore.init()
    }

    if (path === '/') {
        return navigateTo('/register')
    }

    if (!CRM_ROUTES.has(path)) {
        return
    }

    // /register — общий хаб: ФИО уже подставлено из профиля, а кнопки
    // «Бирки»/«Упаковки» ведут в разные потоки, поэтому редиректа отсюда нет.
    if (path === '/register') {
        return
    }

    if (!employeeStore.hasFio) {
        return navigateTo('/register')
    }

    if (path === '/workshop' || path === '/shift') {
        // /shift доступен с любого экрана сразу после регистрации,
        // цех для него не обязателен — список можно смотреть по всем цехам.
        return
    }

    if (!employeeStore.hasWorkshop) {
        return navigateTo(path === '/scan-qr' ? '/workshop?flow=packing' : '/workshop')
    }

    // hasWorkshop — общее персистентное поле для обоих потоков, поэтому
    // для /scan-qr дополнительно требуем явное подтверждение цеха именно
    // для упаковки за эту сессию — иначе цех, выбранный для бирок,
    // открывал бы сканер без повторного выбора (по прямой ссылке, back/forward).
    if (path === '/scan-qr' && !sessionStore.packingWorkshopConfirmed) {
        return navigateTo('/workshop?flow=packing')
    }

    if (path === '/receipt' && !sessionStore.hasSelectedBadge) {
        return navigateTo('/badges')
    }
})
