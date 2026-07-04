<script setup lang="ts">
import {undoHandover} from '~/utils/erp-sheets'
import {formatBadgeDisplay} from '~/utils/erp-csv'
import type {ErpIssuedBadgeEntry} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useHaptics} from '~/composables/useHaptics'

const props = defineProps<{
  entry: ErpIssuedBadgeEntry | null
}>()

const emit = defineEmits<{
  undone: [entry: ErpIssuedBadgeEntry]
  cancel: []
}>()

const employeeStore = useErpEmployeeStore()
const {vibrate} = useHaptics()

type Phase = 'confirm' | 'undoing' | 'error'

const phase = ref<Phase>('confirm')
const error = ref('')

watch(() => props.entry, (value) => {
    if (value) {
        phase.value = 'confirm'
        error.value = ''
    }
})

const confirmUndo = async () => {
    if (!props.entry) return

    vibrate(15)

    phase.value = 'undoing'
    error.value = ''

    try {
        await undoHandover(props.entry, employeeStore.fio)
        vibrate(200)
        emit('undone', props.entry)
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Не удалось отменить сдачу'
        phase.value = 'error'
        vibrate([100, 50, 100])
    }
}

const cancel = () => {
    if (phase.value === 'undoing') return
    emit('cancel')
}
</script>

<template>
  <ErpActionSheet
      :open="!!entry"
      :busy="phase === 'undoing'"
      ariaLabel="Подтверждение отмены сдачи"
      @dismiss="cancel"
  >
    <template #label>{{ phase === 'error' ? 'Ошибка отмены' : 'Отменить сдачу' }}</template>
    <template #content>{{ formatBadgeDisplay(entry?.badge ?? '') }}</template>
    <template #meta>Сдана в {{ entry?.time }} · «Сдача ОГЗ» и «Инженер ОКК» очистятся</template>
    <template v-if="phase === 'error'" #error>{{ error }}</template>
    <template #actions>
      <button
          type="button"
          class="erp-sheet-danger-btn"
          :disabled="phase === 'undoing'"
          @click="confirmUndo"
      >
        {{ phase === 'error' ? 'Повторить отмену' : 'Отменить сдачу' }}
      </button>
      <UiButton block variant="outline" :disabled="phase === 'undoing'" @click="cancel">
        Назад
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
