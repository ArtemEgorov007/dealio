import {defineStore} from 'pinia'

export const useCrmSessionStore = defineStore('crm-session', {
    state: () => ({
        selectedBadge: '' as string,
    }),

    getters: {
        hasSelectedBadge: (state): boolean => state.selectedBadge.trim().length > 0,
    },

    actions: {
        selectBadge(content: string) {
            this.selectedBadge = content.trim()
        },

        clearSelectedBadge() {
            this.selectedBadge = ''
        },
    },
})
