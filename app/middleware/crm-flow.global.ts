import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useCrmSessionStore} from '~~/store/crm-session.store'

const CRM_ROUTES = new Set([
    '/register',
    '/workshop',
    '/badges',
    '/receipt',
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
        if (!employeeStore.hasFio) return navigateTo('/register')
        return navigateTo('/workshop')
    }

    if (!CRM_ROUTES.has(path)) {
        return
    }

    if (path === '/register') {
        if (employeeStore.hasFio) return navigateTo('/workshop')
        return
    }

    if (!employeeStore.hasFio) {
        return navigateTo('/register')
    }

    if (path === '/workshop') {
        return
    }

    if (!employeeStore.hasWorkshop) {
        return navigateTo('/workshop')
    }

    if (path === '/receipt' && !sessionStore.hasSelectedBadge) {
        return navigateTo('/badges')
    }
})
