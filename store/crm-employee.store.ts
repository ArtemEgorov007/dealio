import {defineStore} from 'pinia'

import {isValidFio, type CrmEmployeeProfile, type WorkshopId} from '../types/crm.types'

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

export const useCrmEmployeeStore = defineStore('crm-employee', {
    state: (): CrmEmployeeProfile => ({
        fio: '',
        workshopId: null,
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
        },

        setFio(fio: string) {
            this.fio = fio.trim()
            saveProfile({fio: this.fio, workshopId: this.workshopId})
        },

        setWorkshop(workshopId: WorkshopId) {
            this.workshopId = workshopId
            saveProfile({fio: this.fio, workshopId: this.workshopId})
        },

        clearWorkshop() {
            this.workshopId = null
            saveProfile({fio: this.fio, workshopId: null})
        },

        logout() {
            this.fio = ''
            this.workshopId = null
            clearProfile()
        },
    },
})
