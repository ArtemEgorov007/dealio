<script setup lang="ts">
import {storeToRefs} from 'pinia'

import {decideApproval} from '~/utils/erp-sheets'
import type {ErpApproval} from '~/utils/erp-api'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpApprovalsStore} from '~~/store/erp-approvals.store'
import {useErpApprovalsNotifications} from '~/composables/useErpApprovalsNotifications'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Согласования | ERP'})

const employeeStore = useErpEmployeeStore()
const approvalsStore = useErpApprovalsStore()
const {rows: approvals, loading, error} = storeToRefs(approvalsStore)
const {
  canEnableNotifications,
  enableNotifications,
} = useErpApprovalsNotifications()

const pendingRow = ref<number | null>(null)
const finalStates = ref<Record<number, 'approved' | 'rejected' | 'already_processed'>>({})
const viewerApproval = ref<ErpApproval | null>(null)
const pendingDecision = ref<{approval: ErpApproval; action: 'approve' | 'reject'} | null>(null)

const reload = async () => {
  await approvalsStore.refresh()
}

const openViewer = (approval: ErpApproval) => {
  if (pendingRow.value === approval.rowNumber) return
  viewerApproval.value = approval
}

const closeViewer = () => {
  viewerApproval.value = null
}

const requestDecision = (approval: ErpApproval, action: 'approve' | 'reject') => {
  if (pendingRow.value !== null || finalStates.value[approval.rowNumber]) return
  pendingDecision.value = {approval, action}
}

const cancelDecision = () => {
  if (pendingRow.value !== null) return
  pendingDecision.value = null
}

const confirmDecision = async () => {
  if (!pendingDecision.value) return
  const {approval, action} = pendingDecision.value
  pendingRow.value = approval.rowNumber

  try {
    const result = await decideApproval({rowNumber: approval.rowNumber, action})
    finalStates.value = {
      ...finalStates.value,
      [approval.rowNumber]: result.status,
    }
    pendingDecision.value = null
  } catch {
    pendingDecision.value = null
    await reload()
  } finally {
    pendingRow.value = null
  }
}

const decisionLabel = computed(() =>
  pendingDecision.value?.action === 'approve' ? 'Согласовать счёт?' : 'Отклонить счёт?',
)

onMounted(() => {
  if (!approvals.value.length && !loading.value) void reload()
})
</script>

<template>
  <ErpScreen
      title="Согласования"
      :subtitle="employeeStore.fio"
      icon="heroicons:check-circle"
  >
    <template #actions>
      <UiButton
          v-if="canEnableNotifications"
          size="sm"
          variant="inverse"
          @click="enableNotifications"
      >
        Включить уведомления
      </UiButton>
    </template>

    <ErpEmptyState v-if="loading && approvals.length === 0" loading>
      Загружаем очередь…
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="reload">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="approvals.length === 0">
      <p>Нет счетов, ожидающих вашего решения</p>
      <UiButton variant="outline" @click="reload">Обновить</UiButton>
    </ErpEmptyState>

    <div v-else class="erp-approvals-queue">
      <ErpSectionLabel>Ожидают решения: {{ approvals.length }}</ErpSectionLabel>
      <ErpApprovalCard
          v-for="approval in approvals"
          :key="approval.rowNumber"
          :approval="approval"
          :pending="pendingRow === approval.rowNumber"
          :final-status="finalStates[approval.rowNumber] ?? null"
          @open="openViewer(approval)"
          @request-decision="requestDecision(approval, $event)"
      />
    </div>
  </ErpScreen>

  <ErpInvoiceViewer
      :open="!!viewerApproval"
      :invoice="viewerApproval?.invoice ?? ''"
      :invoice-url="viewerApproval?.invoiceUrl ?? ''"
      @dismiss="closeViewer"
  />

  <ErpActionSheet
      :open="!!pendingDecision"
      :busy="pendingRow !== null"
      aria-label="Подтверждение решения"
      @dismiss="cancelDecision"
  >
    <template #label>{{ decisionLabel }}</template>
    <template #content>{{ pendingDecision?.approval.invoice }}</template>
    <template #meta>{{ pendingDecision?.approval.site }} · {{ pendingDecision?.approval.departmentType }}</template>
    <template #actions>
      <UiButton block :loading="pendingRow !== null" @click="confirmDecision">
        Подтвердить
      </UiButton>
      <UiButton block variant="outline" :disabled="pendingRow !== null" @click="cancelDecision">
        Отмена
      </UiButton>
    </template>
  </ErpActionSheet>
</template>

<style scoped lang="sass">
.erp-approvals-queue
  display: grid
  gap: 14px
</style>
