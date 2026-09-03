import {defineStore} from 'pinia'

import {fetchSupplyRequestsQueue} from '~/utils/erp-supply'
// Импорт явный, хотя Nuxt автоимпортит utils: стор исполняется в изоляции
// в контрактном тесте, где автоимпортов нет.
import {errorMessage} from '~/utils/error-message'
import type {ErpSupplyQueueRequest} from '~/utils/erp-supply'

interface ErpSupplyQueueState {
    rows: ErpSupplyQueueRequest[]
    loading: boolean
    error: string
}

export const useErpSupplyQueueStore = defineStore('erp-supply-queue', {
    state: (): ErpSupplyQueueState => ({
        rows: [],
        loading: false,
        error: '',
    }),

    getters: {
        // Бейдж раздела/таб-бара: сколько заявок ждут, что снабженец заведёт
        // счёт. Тот же приём, что у approvalsStore.pendingCount.
        newCount: (state): number => state.rows.filter(row => row.queueStatus === 'new').length,
    },

    actions: {
        async load() {
            this.loading = true
            this.error = ''
            try {
                this.rows = await fetchSupplyRequestsQueue()
                return this.rows
            } catch (error) {
                this.error = errorMessage(error, 'Не удалось загрузить заявки')
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
