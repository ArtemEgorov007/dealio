import {defineStore} from 'pinia'

import {fetchApprovals} from '~/utils/erp-sheets'
import type {ErpApproval} from '~/utils/erp-api'

interface ErpApprovalsState {
    rows: ErpApproval[]
    pendingCount: number
    loading: boolean
    error: string
}

export const useErpApprovalsStore = defineStore('erp-approvals', {
    state: (): ErpApprovalsState => ({
        rows: [],
        pendingCount: 0,
        loading: false,
        error: '',
    }),

    actions: {
        async load() {
            this.loading = true
            this.error = ''
            try {
                const queue = await fetchApprovals()
                this.rows = queue.rows
                this.pendingCount = queue.pendingCount
                return queue
            } catch (error) {
                this.error = error instanceof Error ? error.message : 'Не удалось загрузить очередь'
                throw error
            } finally {
                this.loading = false
            }
        },

        async refresh() {
            return await this.load()
        },
    },
})
