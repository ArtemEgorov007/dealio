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
    '/warehouse-receive',
    '/warehouse-issue',
    '/warehouse-balance',
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
        '/warehouse-receive': 'warehouse',
        '/warehouse-issue': 'warehouse',
        '/warehouse-balance': 'warehouse',
    }

    const guardedFlag = ACCESS_GUARDED[path]
    if (guardedFlag !== undefined) {
        if (!employeeStore.access[guardedFlag]) {
            return navigateTo('/register')
        }
        return
    }

    // Бирки (/workshop, /badges, /receipt, /shift) требуют access.badges;
    // упаковка (/scan-qr) — access.packing. Таб-бар уже прячет эти разделы
    // без доступа, но прямой переход по URL раньше не проверялся вовсе.
    const BADGES_ROUTES = new Set(['/workshop', '/badges', '/receipt', '/shift'])
    if (BADGES_ROUTES.has(path) && !employeeStore.access.badges) {
        return navigateTo('/register')
    }
    if (path === '/scan-qr' && !employeeStore.access.packing) {
        return navigateTo('/register')
    }

    // /scan-qr не требует выбора цеха — упаковка пишет площадку из профиля
    // сотрудника напрямую, отдельного экрана выбора цеха для неё нет.
    if (path === '/workshop' || path === '/shift' || path === '/scan-qr') {
        return
    }

    if (!employeeStore.hasWorkshop) {
        return navigateTo('/workshop')
    }

    if (path === '/receipt' && !sessionStore.hasSelectedBadge) {
        return navigateTo('/badges')
    }
})
