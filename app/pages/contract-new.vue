<script setup lang="ts">
import {createContract} from '~/utils/erp-contracts'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Новый договор | ERP'})

const router = useRouter()
const {showSuccess, showError} = useAppToast()

const internalNumber = ref('')
const contractNumber = ref('')
const customer = ref('')
const subject = ref('')
const limitAmount = ref('')
const isSubmitting = ref(false)

const parsedLimit = computed(() =>
    // \u00A0 и \u202F — неразрывные пробелы: их ставит форматирование сумм.
    Number(limitAmount.value.replace(/[\s\u00A0\u202F₽]/g, '').replace(',', '.')),
)

// Все поля обязательны — так задано в приёмке.
const canSubmit = computed(() =>
    internalNumber.value.trim() !== ''
    && contractNumber.value.trim() !== ''
    && customer.value.trim() !== ''
    && subject.value.trim() !== ''
    && parsedLimit.value > 0
    && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        const result = await createContract({
            internalNumber: internalNumber.value.trim(),
            contractNumber: contractNumber.value.trim(),
            customer: customer.value.trim(),
            subject: subject.value.trim(),
            limitAmount: limitAmount.value,
        })
        showSuccess(`Договор ${result.internalNumber} заведён`)
        await router.push({path: '/contract', query: {id: result.id}})
    } catch (error) {
        showError(error, 'Не удалось завести договор')
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
  <ErpScreen
      title="Добавить договор"
      subtitle="Новый договор"
      icon="heroicons:document-plus"
      :shift-link="{to: '/contracts', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpSectionLabel>Договор</ErpSectionLabel>
    <div class="ctr-fields">
      <label class="ctr-field">
        <span class="ctr-field__label">Внутренний номер</span>
        <input v-model="internalNumber" type="text" class="ctr-input" placeholder="Например, 2026-14">
        <span class="ctr-field__note">По нему договор связывается с расценками и работами</span>
      </label>

      <label class="ctr-field">
        <span class="ctr-field__label">Номер договора</span>
        <input v-model="contractNumber" type="text" class="ctr-input" placeholder="Номер по документу">
      </label>

      <label class="ctr-field">
        <span class="ctr-field__label">Заказчик</span>
        <input v-model="customer" type="text" class="ctr-input" placeholder="Наименование заказчика">
      </label>

      <label class="ctr-field">
        <span class="ctr-field__label">Предмет договора</span>
        <textarea v-model="subject" class="ctr-input ctr-input--area" rows="3" placeholder="Что выполняется по договору"/>
      </label>

      <label class="ctr-field">
        <span class="ctr-field__label">Предельная сумма</span>
        <input v-model="limitAmount" type="text" inputmode="decimal" class="ctr-input ctr-input--amount" placeholder="0,00">
      </label>
    </div>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">Внести</UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.ctr-fields
  display: flex
  flex-direction: column
  gap: 12px

.ctr-field
  display: block
  min-width: 0

.ctr-field__label
  display: block
  margin: 0 0 4px 12px
  font-size: 11px
  font-weight: 600
  letter-spacing: 0.2px
  text-transform: uppercase
  color: var(--color-text-secondary)

.ctr-field__note
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--color-text-secondary)

.ctr-input
  width: 100%
  padding: 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  color: var(--color-text)
  // Размер шрифта не задаём: erp-theme.css держит поля на 16px против зума iOS.

  &::placeholder
    color: var(--color-text-secondary)
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.ctr-input--area
  resize: vertical
  font-family: inherit

.ctr-input--amount
  text-align: right
  font-variant-numeric: tabular-nums
</style>
