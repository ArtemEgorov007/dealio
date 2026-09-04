<script setup lang="ts">
import {completeIntakeUnmatched, fetchIntakeForm} from '~/utils/erp-intake'
import type {ErpIntakeFormData} from '~/utils/erp-intake'
import {useAppToast} from '~/composables/useAppToast'
import type {ErpComboboxOption} from '~/components/erp/ErpCombobox.vue'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приход: нет данных | ERP'})

const route = useRoute()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const deliveryId = computed(() => Number(route.query.id))

const form = ref<ErpIntakeFormData | null>(null)
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    if (!deliveryId.value) {
        await router.replace('/intake')
        return
    }
    isLoading.value = true
    loadError.value = ''
    try {
        form.value = await fetchIntakeForm()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить сотрудников ПТО')
    } finally {
        isLoading.value = false
    }
}
onMounted(load)

const title = ref('')
const ptoFio = ref('')
const isSubmitting = ref(false)

const ptoOptions = computed<ErpComboboxOption[]>(() => (form.value?.ptoEmployees ?? []).map(value => ({value})))
const isPtoKnown = computed(() => (form.value?.ptoEmployees ?? []).includes(ptoFio.value.trim()))

const canSubmit = computed(() =>
    title.value.trim() !== '' && isPtoKnown.value && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        await completeIntakeUnmatched(deliveryId.value, {
            title: title.value.trim(),
            ptoFio: ptoFio.value.trim(),
        })
        showSuccess('Сотрудник ПТО уведомлён', title.value.trim())
        await router.push('/intake')
    } catch (error) {
        showError(error, 'Не удалось отправить уведомление')
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
  <ErpScreen
      title="Приход"
      subtitle="Нет проектных данных"
      icon="heroicons:truck"
      :shift-link="{to: '/intake', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Титул и ответственный</ErpSectionLabel>

      <div class="intake-form">
        <input
            v-model="title"
            type="text"
            class="intake-input"
            placeholder="Титул (вручную)"
        >

        <ErpCombobox
            v-model="ptoFio"
            :options="ptoOptions"
            placeholder="Сотрудник ПТО"
            unresolved-hint="Выберите сотрудника из списка"
        />
      </div>
    </template>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">
        Отправить уведомление
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.intake-form
  display: flex
  flex-direction: column
  gap: 8px

.intake-input
  width: 100%
  padding: 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  color: var(--color-text)

  &::placeholder
    color: var(--color-text-secondary)
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px
</style>
