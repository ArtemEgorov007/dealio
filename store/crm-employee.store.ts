import {defineStore} from 'pinia'

import {
    isValidFio,
    type CrmAccessFlags,
    type CrmEmployeeProfile,
    type WorkshopId,
    DEFAULT_ACCESS_FLAGS,
} from '../types/crm.types'

const STORAGE_KEY = 'crm-employee-profile'

function loadProfile(): CrmEmployeeProfile | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as CrmEmployeeProfile
    } catch {
        return null
    }
}

function saveProfile(profile: CrmEmployeeProfile): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
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
    access: CrmAccessFlags
}

export const useCrmEmployeeStore = defineStore('crm-employee', {
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
            saveProfile(this.$state as CrmEmployeeProfile)
        },

        setProfile(profile: {
            fio: string
            department: string
            position: string
            platform: string
            login: string
            password: string
            access: CrmAccessFlags
        }) {
            this.fio = profile.fio
            this.department = profile.department
            this.position = profile.position
            this.platform = profile.platform
            this.login = profile.login
            this.password = profile.password
            this.access = profile.access
            saveProfile(this.$state as CrmEmployeeProfile)
        },

        setWorkshop(workshopId: WorkshopId) {
            this.workshopId = workshopId
            saveProfile(this.$state as CrmEmployeeProfile)
        },

        clearWorkshop() {
            this.workshopId = null
            saveProfile(this.$state as CrmEmployeeProfile)
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
