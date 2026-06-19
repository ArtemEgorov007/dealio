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
    if (DEALIO_PREFIXES.some(prefix => to.path === prefix || to.path.startsWith(`${prefix}/`))) {
        return
    }

    const employeeStore = useCrmEmployeeStore()
    const sessionStore = useCrmSessionStore()

    if (import.meta.client) {
        employeeStore.init()
    }

    if (to.path === '/') {
        if (!employeeStore.hasFio) return navigateTo('/register')
        return navigateTo('/workshop')
    }

    if (!CRM_ROUTES.has(to.path)) {
        return
    }

    if (to.path === '/register') {
        if (employeeStore.hasFio) return navigateTo('/workshop')
        return
    }

    if (!employeeStore.hasFio) {
        return navigateTo('/register')
    }

    if (to.path === '/workshop') {
        return
    }

    if (!employeeStore.hasWorkshop) {
        return navigateTo('/workshop')
    }

    if (to.path === '/receipt' && !sessionStore.hasSelectedBadge) {
        return navigateTo('/badges')
    }
})
