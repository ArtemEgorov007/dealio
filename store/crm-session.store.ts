import {defineStore} from 'pinia'

export const useCrmSessionStore = defineStore('crm-session', {
    state: () => ({
        selectedBadge: '' as string,
        issued: false,
    }),

    getters: {
        hasSelectedBadge: (state): boolean => state.selectedBadge.trim().length > 0,
    },

    actions: {
        selectBadge(content: string) {
            this.selectedBadge = content.trim()
            this.issued = false
        },

        markIssued() {
            this.issued = true
        },

        clearSelectedBadge() {
            this.selectedBadge = ''
            this.issued = false
        },
    },
})
