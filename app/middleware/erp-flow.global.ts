import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'

const ERP_ROUTES = new Set([
    '/register',
    '/workshop',
    '/badges',
    '/receipt',
    '/shift',
    '/scan-qr',
    '/scan-handover',
    '/handover-shift',
    '/scan-measurement',
    '/measurement',
    '/reports',
    '/approvals',
    '/supply',
    '/orders',
    '/warehouse',
])

const DEALIO_PREFIXES = ['/board', '/login', '/archive', '/settings', '/dashboard', '/ideas', '/tasks', '/wishlist', '/help']

export default defineNuxtRouteMiddleware((to) => {
    // GitHub Pages добавляет конечный слэш при прямой навигации/обновлении страницы
    // (например /badges/) — без нормализации сравнения ниже не сработают.
    const path = to.path.length > 1 ? to.path.replace(/\/$/, '') : to.path

    if (DEALIO_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
        return
    }

    const employeeStore = useErpEmployeeStore()
    const sessionStore = useErpSessionStore()

    if (path === '/') {
        return navigateTo('/register')
    }

    if (!ERP_ROUTES.has(path)) {
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

    const ACCESS_GUARDED: Record<string, keyof typeof employeeStore.access> = {
        '/scan-measurement': 'measurements',
        '/measurement': 'measurements',
        '/scan-handover': 'handover',
        '/handover-shift': 'handover',
        '/reports': 'reports',
        '/approvals': 'approvals',
        '/supply': 'supply',
        '/orders': 'orders',
        '/warehouse': 'warehouse',
    }

    const guardedFlag = ACCESS_GUARDED[path]
    if (guardedFlag !== undefined) {
        if (!employeeStore.access[guardedFlag]) {
            return navigateTo('/register')
        }
        return
    }

    // Бирки (/workshop без flow=packing, /badges, /receipt, /shift) требуют
    // access.badges; упаковка (/workshop?flow=packing, /scan-qr) — access.packing.
    // Таб-бар уже прячет эти разделы без доступа, но прямой переход по URL
    // раньше не проверялся вовсе — не ранний return, ниже ещё есть проверки
    // hasWorkshop/packingWorkshopConfirmed/hasSelectedBadge для этих же путей.
    const BADGES_OR_PACKING_ROUTES = new Set(['/workshop', '/badges', '/receipt', '/shift', '/scan-qr'])
    if (BADGES_OR_PACKING_ROUTES.has(path)) {
        const isPackingRoute = path === '/scan-qr' || (path === '/workshop' && to.query.flow === 'packing')
        const requiredFlag = isPackingRoute ? 'packing' : 'badges'
        if (!employeeStore.access[requiredFlag]) {
            return navigateTo('/register')
        }
    }

    if (path === '/workshop' || path === '/shift') {
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
