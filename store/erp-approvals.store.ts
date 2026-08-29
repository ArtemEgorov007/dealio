import {defineStore} from 'pinia'

import {fetchApprovals} from '~/utils/erp-sheets'
// Импорт явный, хотя Nuxt автоимпортит utils: стор исполняется в изоляции
// в контрактном тесте, где автоимпортов нет.
import {errorMessage} from '~/utils/error-message'
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
                this.error = errorMessage(error, 'Не удалось загрузить очередь')
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
