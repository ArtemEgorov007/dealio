import {defineStore} from 'pinia'

export const useCrmSessionStore = defineStore('crm-session', {
    state: () => ({
        selectedBadge: '' as string,
        issued: false,
        journalSkipped: false,
    }),

    getters: {
        hasSelectedBadge: (state): boolean => state.selectedBadge.trim().length > 0,
    },

    actions: {
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
    },
})
