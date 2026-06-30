<script setup lang="ts">
import {appendBadgeJournalEntry} from '~/utils/crm-sheets'
import {formatBadgeDisplay} from '~/utils/crm-csv'
import {workshopLabel} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useHaptics} from '~/composables/useHaptics'

const props = defineProps<{
  badge: string | null
}>()

const emit = defineEmits<{
  issued: [skipped: boolean]
  cancel: []
}>()

const employeeStore = useCrmEmployeeStore()
const {vibrate} = useHaptics()

type Phase = 'confirm' | 'saving' | 'error'

const phase = ref<Phase>('confirm')
const error = ref('')

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

watch(() => props.badge, (value) => {
    if (value) {
        phase.value = 'confirm'
        error.value = ''
    }
})

const confirm = async () => {
    if (!props.badge || !employeeStore.workshopId) return

    // Вибрировать нужно синхронно в обработчике тапа — после await на
    // сетевой запрос браузер уже не считает это ответом на жест пользователя
    // и тихо игнорирует вызов (заметнее всего в Chrome на Android).
    vibrate(15)

    phase.value = 'saving'
    error.value = ''

    try {
        const result = await appendBadgeJournalEntry({
            workshopId: employeeStore.workshopId,
            fio: employeeStore.fio,
            badgeContent: props.badge,
        })

        vibrate(200)
        emit('issued', result === 'skipped')
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Не удалось записать в журнал'
        phase.value = 'error'
        vibrate([100, 50, 100])
    }
}

const cancel = () => {
    if (phase.value === 'saving') return
    emit('cancel')
}
</script>

<template>
  <CrmActionSheet
      :open="!!badge"
      :busy="phase === 'saving'"
      aria-label="Подтверждение выдачи бирки"
      @dismiss="cancel"
  >
    <template #label>{{ phase === 'error' ? 'Ошибка записи' : 'Выдать бирку' }}</template>
    <template #content>{{ formatBadgeDisplay(badge ?? '') }}</template>
    <template #meta>{{ employeeStore.fio }} · {{ workshopTitle }}</template>
    <template v-if="phase === 'error'" #error>{{ error }}</template>
    <template #actions>
      <UiButton block :loading="phase === 'saving'" @click="confirm">
        {{ phase === 'error' ? 'Повторить' : 'Подтвердить выдачу' }}
      </UiButton>
      <UiButton block variant="outline" :disabled="phase === 'saving'" @click="cancel">
        {{ phase === 'error' ? 'Отмена' : 'Это не та бирка' }}
      </UiButton>
    </template>
  </CrmActionSheet>
</template>
