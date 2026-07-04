import {defineStore} from 'pinia'

import {
    isValidFio,
    type ErpAccessFlags,
    type ErpEmployeeProfile,
    type WorkshopId,
    DEFAULT_ACCESS_FLAGS,
} from '../types/erp.types'

const STORAGE_KEY = 'erp-employee-profile'
const VERSION_KEY = 'erp-profile-version'
// Бампать при смене модели доступа. Профиль старой версии сбрасывается —
// сотрудник входит заново и получает актуальные флаги из таблицы.
// v2: переход на fail-closed доступы (пустой флаг = нет доступа).
const PROFILE_VERSION = '2'

function loadProfile(): ErpEmployeeProfile | null {
    if (typeof window === 'undefined') return null

    if (localStorage.getItem(VERSION_KEY) !== PROFILE_VERSION) {
        clearProfile()
        return null
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as ErpEmployeeProfile
    } catch {
        return null
    }
}

function saveProfile(profile: ErpEmployeeProfile): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    localStorage.setItem(VERSION_KEY, PROFILE_VERSION)
}

function clearProfile(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
}

interface EmployeeState {
    fio: string
    workshopId: WorkshopId | null
    department: string
    position: string
    platform: string
    login: string
    password: string
    access: ErpAccessFlags
}

export const useErpEmployeeStore = defineStore('erp-employee', {
    state: (): EmployeeState => ({
        fio: '',
        workshopId: null,
        department: '',
        position: '',
        platform: '',
        login: '',
        password: '',
        access: {...DEFAULT_ACCESS_FLAGS},
    }),

    getters: {
        hasFio: (state): boolean => isValidFio(state.fio),
        hasWorkshop: (state): boolean => state.workshopId !== null,
    },

    actions: {
        init() {
            const stored = loadProfile()
            if (!stored) return
            this.fio = stored.fio
            this.workshopId = stored.workshopId
            this.department = stored.department ?? ''
            this.position = stored.position ?? ''
            this.platform = stored.platform ?? ''
            this.login = stored.login ?? ''
            this.password = stored.password ?? ''
            this.access = {...DEFAULT_ACCESS_FLAGS, ...(stored.access ?? {})}
        },

        setFio(fio: string) {
            this.fio = fio.trim()
            saveProfile(this.$state as ErpEmployeeProfile)
        },

        setProfile(profile: {
            fio: string
            department: string
            position: string
            platform: string
            login: string
            password: string
            access: ErpAccessFlags
        }) {
            this.fio = profile.fio
            this.department = profile.department
            this.position = profile.position
            this.platform = profile.platform
            this.login = profile.login
            this.password = profile.password
            this.access = profile.access
            saveProfile(this.$state as ErpEmployeeProfile)
        },

        // Динамическое обновление прав: тихо перелогиниваемся по сохранённым
        // учёткам и подтягиваем свежие доступы из таблицы. Ошибку глотаем —
        // при сбое сети оставляем кэш, работу не прерываем. workshopId не
        // трогаем (setProfile его не задаёт).
        async refreshProfile() {
            if (typeof window === 'undefined') return
            if (!this.login || !this.password) return
            try {
                const {loginErpEmployee} = await import('~/utils/erp-sheets')
                const profile = await loginErpEmployee(this.login, this.password)
                this.setProfile(profile)
            } catch {
                // сеть/аккаунт недоступны — оставляем кэш
            }
        },

        setWorkshop(workshopId: WorkshopId) {
            this.workshopId = workshopId
            saveProfile(this.$state as ErpEmployeeProfile)
        },

        clearWorkshop() {
            this.workshopId = null
            saveProfile(this.$state as ErpEmployeeProfile)
        },

        logout() {
            this.fio = ''
            this.workshopId = null
            this.department = ''
            this.position = ''
            this.platform = ''
            this.login = ''
            this.password = ''
            this.access = {...DEFAULT_ACCESS_FLAGS}
            clearProfile()
        },
    },
})
