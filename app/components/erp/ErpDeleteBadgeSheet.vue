<script setup lang="ts">
import {deleteIssuedBadge} from '~/utils/erp-sheets'
import {formatBadgeDisplay} from '~/utils/erp-csv'
import type {ErpIssuedBadgeEntry} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useHaptics} from '~/composables/useHaptics'

const props = defineProps<{
  entry: ErpIssuedBadgeEntry | null
}>()

const emit = defineEmits<{
  deleted: [entry: ErpIssuedBadgeEntry]
  cancel: []
}>()

const employeeStore = useErpEmployeeStore()
const {vibrate} = useHaptics()

type Phase = 'confirm' | 'deleting' | 'error'

const phase = ref<Phase>('confirm')
const error = ref('')

watch(() => props.entry, (value) => {
    if (value) {
        phase.value = 'confirm'
        error.value = ''
    }
})

const confirmDelete = async () => {
    if (!props.entry) return

    vibrate(15)

    phase.value = 'deleting'
    error.value = ''

    try {
        await deleteIssuedBadge(props.entry, employeeStore.fio)
        vibrate(200)
        emit('deleted', props.entry)
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Не удалось удалить бирку'
        phase.value = 'error'
        vibrate([100, 50, 100])
    }
}

const cancel = () => {
    if (phase.value === 'deleting') return
    emit('cancel')
}
</script>

<template>
  <ErpActionSheet
      :open="!!entry"
      :busy="phase === 'deleting'"
      aria-label="Подтверждение удаления бирки"
      @dismiss="cancel"
  >
    <template #label>{{ phase === 'error' ? 'Ошибка удаления' : 'Удалить бирку' }}</template>
    <template #content>{{ formatBadgeDisplay(entry?.badge ?? '') }}</template>
    <template #meta>Выдана в {{ entry?.time }} · действие нельзя отменить</template>
    <template v-if="phase === 'error'" #error>{{ error }}</template>
    <template #actions>
      <button
          type="button"
          class="erp-sheet-danger-btn"
          :disabled="phase === 'deleting'"
          @click="confirmDelete"
      >
        {{ phase === 'error' ? 'Повторить удаление' : 'Удалить' }}
      </button>
      <UiButton block variant="outline" :disabled="phase === 'deleting'" @click="cancel">
        Отмена
      </UiButton>
    </template>
  </ErpActionSheet>
</template>

<style scoped lang="sass">
.erp-sheet-danger-btn
  width: 100%
  height: 44px
  border: none
  border-radius: var(--radius-md)
  background-color: var(--color-danger)
  color: #fff
  font-size: var(--font-size-md)
  font-weight: 600
  cursor: pointer

  &:disabled
    opacity: 0.6
    cursor: default
</style>
