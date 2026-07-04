import {defineStore} from 'pinia'

export const useErpSessionStore = defineStore('erp-session', {
    state: () => ({
        selectedBadge: '' as string,
        issued: false,
        journalSkipped: false,
        packingWorkshopConfirmed: false,
        measurementBadge: '' as string,
    }),

    getters: {
        hasSelectedBadge: (state): boolean => state.selectedBadge.trim().length > 0,
        hasMeasurementBadge: (state): boolean => state.measurementBadge.trim().length > 0,
    },

    actions: {
        // Не персистится — при прямом переходе/F5 на /scan-qr (или после
        // выбора цеха для бирок) сбрасывается, и middleware заново гонит
        // через /workshop?flow=packing, чтобы цех не «утекал» между потоками.
        setPackingWorkshopConfirmed(value: boolean) {
            this.packingWorkshopConfirmed = value
        },

        selectBadge(content: string) {
            this.selectedBadge = content.trim()
            this.issued = false
            this.journalSkipped = false
        },

        markIssued(journalSkipped = false) {
            this.issued = true
            this.journalSkipped = journalSkipped
        },

        clearSelectedBadge() {
            this.selectedBadge = ''
            this.issued = false
            this.journalSkipped = false
        },

        setMeasurementBadge(badge: string) {
            this.measurementBadge = badge.trim()
        },

        clearMeasurementBadge() {
            this.measurementBadge = ''
        },
    },
})
