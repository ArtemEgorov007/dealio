<script setup lang="ts">
import {createIntakeDelivery, fetchIntakeForm} from '~/utils/erp-intake'
import type {ErpIntakeFormData} from '~/utils/erp-intake'
import {useAppToast} from '~/composables/useAppToast'
import type {ErpComboboxOption} from '~/components/erp/ErpCombobox.vue'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приход | ERP'})

const router = useRouter()
const {showError} = useAppToast()

const form = ref<ErpIntakeFormData | null>(null)
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        form.value = await fetchIntakeForm()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить титулы')
    } finally {
        isLoading.value = false
    }
}
onMounted(load)

const title = ref('')
const waybillNumber = ref('')
// v-model на <input type="number"> отдаёт число, а на пустом поле — пустую
// строку, поэтому тип честно допускает оба варианта (тот же приём, что у
// количества в «Заказе снабжения»).
const weightTons = ref<string | number>('')
const photoFile = ref<File | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const photoPreviewUrl = ref('')

const titleOptions = computed<ErpComboboxOption[]>(() => (form.value?.titles ?? []).map(value => ({value})))
const isTitleKnown = computed(() => (form.value?.titles ?? []).includes(title.value.trim()))

const onPhotoChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    photoFile.value = file
    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
    photoPreviewUrl.value = file ? URL.createObjectURL(file) : ''
}

onBeforeUnmount(() => {
    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
})

const weightValue = computed(() => {
    const raw = typeof weightTons.value === 'number' ? weightTons.value : Number(String(weightTons.value).replace(',', '.'))
    return Number.isFinite(raw) ? raw : 0
})

const baseFieldsFilled = computed(() =>
    waybillNumber.value.trim() !== '' && weightValue.value > 0 && photoFile.value !== null,
)

const canSubmitMatched = computed(() => baseFieldsFilled.value && isTitleKnown.value && !isSubmitting.value)
const canSubmitUnmatched = computed(() => baseFieldsFilled.value && !isSubmitting.value)

const isSubmitting = ref(false)

const intakeKey = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 32)
        : `${Date.now()}${Math.random()}`.replace(/\D/g, '').slice(0, 32)

const submit = async (mode: 'matched' | 'unmatched') => {
    if (mode === 'matched' && !canSubmitMatched.value) return
    if (mode === 'unmatched' && !canSubmitUnmatched.value) return
    if (!photoFile.value) return

    isSubmitting.value = true
    try {
        const result = await createIntakeDelivery({
            title: mode === 'matched' ? title.value.trim() : '',
            waybillNumber: waybillNumber.value.trim(),
            weightTons: String(weightValue.value),
            photo: photoFile.value,
            idempotencyKey: intakeKey(),
        })

        if (mode === 'matched') {
            await router.push({path: '/intake-objects', query: {id: String(result.id), title: result.title ?? title.value.trim()}})
        } else {
            await router.push({path: '/intake-unmatched', query: {id: String(result.id)}})
        }
    } catch (error) {
        showError(error, 'Не удалось сохранить накладную')
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
  <ErpScreen
      title="Приход"
      subtitle="Приёмка объектов выполнения работ"
      icon="heroicons:truck"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Накладная</ErpSectionLabel>

      <div class="intake-form">
        <div class="intake-field">
          <ErpCombobox
              v-model="title"
              :options="titleOptions"
              placeholder="Титул"
              unresolved-hint="Титула нет в системе — нажмите «Нет данных»"
          />
        </div>

        <input
            v-model="waybillNumber"
            type="text"
            class="intake-input"
            placeholder="Номер накладной"
        >

        <input
            v-model="weightTons"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            class="intake-input"
            placeholder="Вес по накладной, т"
        >

        <button type="button" class="intake-photo" @click="photoInput?.click()">
          <img v-if="photoPreviewUrl" :src="photoPreviewUrl" alt="" class="intake-photo__preview">
          <template v-else>
            <Icon name="heroicons:camera" size="22"/>
            <span>Сфотографировать накладную</span>
          </template>
        </button>
        <input
            ref="photoInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="intake-photo__input"
            @change="onPhotoChange"
        >
      </div>
    </template>

    <template #footer>
      <div class="intake-actions">
        <UiButton block :disabled="!canSubmitMatched" :loading="isSubmitting" @click="submit('matched')">
          Внести элементы
        </UiButton>
        <UiButton block variant="outline" :disabled="!canSubmitUnmatched" :loading="isSubmitting" @click="submit('unmatched')">
          Нет данных
        </UiButton>
      </div>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.intake-form
  display: flex
  flex-direction: column
  gap: 8px

.intake-field
  min-width: 0

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

.intake-photo
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: 8px
  height: 140px
  border: 1.5px dashed rgba(60, 60, 67, 0.24)
  border-radius: 14px
  background: var(--color-card-bg)
  color: var(--color-text-secondary)
  font-size: 13px
  cursor: pointer
  overflow: hidden

.intake-photo__preview
  width: 100%
  height: 100%
  object-fit: cover

.intake-photo__input
  position: absolute
  width: 1px
  height: 1px
  opacity: 0
  pointer-events: none

.intake-actions
  display: flex
  flex-direction: column
  gap: 8px
</style>
