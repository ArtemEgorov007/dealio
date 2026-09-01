<script setup lang="ts">
import {createInvoice, fetchInvoiceFormData} from '~/utils/erp-supply'
import type {ErpInvoiceFormData, ErpInvoiceRequestOption} from '~/utils/erp-supply'
import {useAppToast} from '~/composables/useAppToast'
import type {ErpComboboxOption} from '~/components/erp/ErpCombobox.vue'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Завести счёт | ERP'})

const {showSuccess, showError} = useAppToast()

const form = ref<ErpInvoiceFormData | null>(null)
const isLoading = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)

const invoice = ref('')
const contract = ref('')
const requestCode = ref('')
const amount = ref('')
const approverFio = ref('')
const file = ref<File | null>(null)
const fileError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        form.value = await fetchInvoiceFormData()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить данные формы')
    } finally {
        isLoading.value = false
    }
}

// Заявка в списке подписана площадкой и статусом: снабженец должен видеть,
// на что заводит счёт, не открывая другой экран.
const requestOptions = computed<ErpComboboxOption[]>(() =>
    (form.value?.requests ?? []).map(request => ({
        value: request.requestCode,
        hint: [request.platform, request.status].filter(Boolean).join(' · '),
    })),
)

// В поле попадает внутренний номер — им счёт и связывается с договором.
// Заказчик идёт подписью: номер помнить никто не обязан.
const contractOptions = computed<ErpComboboxOption[]>(() =>
    (form.value?.contracts ?? []).map(item => ({value: item.internalNumber, hint: item.customer})),
)

const selectedContract = computed(() =>
    form.value?.contracts.find(item => item.internalNumber === contract.value.trim()) ?? null,
)

// Договор необязателен, но выбранный должен быть из справочника: иначе в
// счёте окажется ссылка в никуда.
const isContractKnown = computed(() =>
    contract.value.trim() === '' || selectedContract.value !== null,
)

const approverOptions = computed<ErpComboboxOption[]>(() =>
    (form.value?.approvers ?? []).map(value => ({value})),
)

const selectedRequest = computed<ErpInvoiceRequestOption | null>(() =>
    form.value?.requests.find(request => request.requestCode === requestCode.value.trim()) ?? null,
)

const maxFileMb = computed(() =>
    form.value ? Math.round((form.value.maxFileBytes / 1048576) * 10) / 10 : 0,
)

const formatBytes = (bytes: number): string =>
    bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`

/**
 * Проверяем файл до отправки.
 *
 * Лимит приходит с сервера: настройки PHP на хостинге бывают ниже нашей
 * границы, и узнать реальный предел можно только у него. Отказ на клиенте
 * экономит минуту загрузки по мобильной связи ради ответа «файл слишком
 * большой».
 */
const onFileChange = (event: Event) => {
    fileError.value = ''
    const picked = (event.target as HTMLInputElement).files?.[0] ?? null
    if (!picked) {
        file.value = null
        return
    }
    if (!picked.name.toLowerCase().endsWith('.pdf')) {
        fileError.value = 'Нужен файл PDF'
        file.value = null
        return
    }
    const limit = form.value?.maxFileBytes ?? 0
    if (limit > 0 && picked.size > limit) {
        fileError.value = `Файл ${formatBytes(picked.size)} — больше ${maxFileMb.value} МБ`
        file.value = null
        return
    }
    file.value = picked
}

const clearFile = () => {
    file.value = null
    fileError.value = ''
    if (fileInput.value) fileInput.value.value = ''
}

const parsedAmount = computed(() =>
    // \u00A0 и \u202F — неразрывные пробелы: их ставит форматирование сумм,
    // и в исходнике их держать нельзя (линтер справедливо ругается).
    Number(amount.value.replace(/[\s\u00A0\u202F₽]/g, '').replace(',', '.')),
)

const isRequestKnown = computed(() =>
    requestCode.value.trim() !== '' && selectedRequest.value !== null,
)

const isApproverKnown = computed(() =>
    approverFio.value.trim() !== '' && (form.value?.approvers ?? []).includes(approverFio.value.trim()),
)

const canSubmit = computed(() =>
    invoice.value.trim() !== ''
    && isRequestKnown.value
    && isContractKnown.value
    && parsedAmount.value > 0
    && isApproverKnown.value
    && file.value !== null
    && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value || !file.value) return
    isSubmitting.value = true
    try {
        const result = await createInvoice({
            invoice: invoice.value.trim(),
            contract: contract.value.trim(),
            requestCode: requestCode.value.trim(),
            amount: amount.value,
            approverFio: approverFio.value.trim(),
            file: file.value,
        })
        showSuccess(`Счёт ${result.invoice} направлен`, `Согласующий: ${approverFio.value}`)
        invoice.value = ''
        contract.value = ''
        requestCode.value = ''
        amount.value = ''
        approverFio.value = ''
        clearFile()
        // Договоры пополняются введёнными значениями — перечитываем форму.
        void load()
    } catch (error) {
        showError(error, 'Не удалось направить счёт')
    } finally {
        isSubmitting.value = false
    }
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Завести счёт"
      subtitle="Направить на согласование"
      icon="heroicons:document-plus"
      :shift-link="{to: '/supply-work', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Счёт</ErpSectionLabel>
      <div class="invoice-fields">
        <label class="invoice-field">
          <span class="invoice-field__label">Номер счёта</span>
          <input v-model="invoice" type="text" class="invoice-input" placeholder="Например, 308/1">
        </label>

        <label class="invoice-field">
          <span class="invoice-field__label">Номер заявки</span>
          <ErpCombobox
              v-model="requestCode"
              :options="requestOptions"
              placeholder="Выберите заявку"
              unresolved-hint="Выберите заявку из списка"
          />
          <span v-if="selectedRequest" class="invoice-field__note">
            {{ [selectedRequest.platform, selectedRequest.department, selectedRequest.category].filter(Boolean).join(' · ') }}
          </span>
        </label>

        <label class="invoice-field">
          <span class="invoice-field__label">Договор</span>
          <ErpCombobox
              v-model="contract"
              :options="contractOptions"
              placeholder="Внутренний номер договора"
              unresolved-hint="Выберите договор из справочника"
          />
          <span v-if="selectedContract" class="invoice-field__note">{{ selectedContract.customer }}</span>
          <span v-else class="invoice-field__note">Необязательно. Договоры заводятся в разделе «Договоры»</span>
        </label>

        <label class="invoice-field">
          <span class="invoice-field__label">Сумма счёта</span>
          <input
              v-model="amount"
              type="text"
              inputmode="decimal"
              class="invoice-input invoice-input--amount"
              placeholder="0,00"
          >
        </label>

        <label class="invoice-field">
          <span class="invoice-field__label">На согласование</span>
          <ErpCombobox
              v-model="approverFio"
              :options="approverOptions"
              placeholder="ФИО согласующего"
              unresolved-hint="Выберите сотрудника с правом согласования"
          />
        </label>
      </div>

      <ErpSectionLabel>Файл счёта</ErpSectionLabel>
      <div class="invoice-file">
        <input
            ref="fileInput"
            type="file"
            accept="application/pdf,.pdf"
            class="invoice-file__input"
            @change="onFileChange"
        >
        <button type="button" class="invoice-file__pick" @click="fileInput?.click()">
          <Icon name="heroicons:paper-clip" size="17"/>
          <span>{{ file ? 'Заменить файл' : 'Прикрепить PDF' }}</span>
        </button>

        <div v-if="file" class="invoice-file__picked">
          <Icon name="heroicons:document-text" size="17" class="invoice-file__icon"/>
          <span class="invoice-file__name">{{ file.name }}</span>
          <span class="invoice-file__size">{{ formatBytes(file.size) }}</span>
          <button type="button" class="invoice-file__clear" aria-label="Убрать файл" @click="clearFile">
            <Icon name="heroicons:x-mark" size="15"/>
          </button>
        </div>

        <p v-if="fileError" class="invoice-file__error">{{ fileError }}</p>
        <p v-else-if="!file" class="invoice-file__limit">PDF, не больше {{ maxFileMb }} МБ</p>
      </div>
    </template>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">
        Направить
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.invoice-fields
  display: flex
  flex-direction: column
  gap: 12px

.invoice-field
  display: block
  min-width: 0

.invoice-field__label
  display: block
  margin: 0 0 4px 12px
  font-size: 11px
  font-weight: 600
  letter-spacing: 0.2px
  text-transform: uppercase
  color: var(--color-text-secondary)

.invoice-field__note
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--color-text-secondary)

.invoice-input
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

.invoice-input--amount
  text-align: right
  font-variant-numeric: tabular-nums

.invoice-file
  display: flex
  flex-direction: column
  gap: 8px

.invoice-file__input
  display: none

.invoice-file__pick
  display: flex
  align-items: center
  justify-content: center
  gap: 8px
  padding: 12px
  border: 1px dashed var(--color-primary)
  border-radius: 12px
  background: var(--color-primary-light)
  color: var(--color-primary)
  font-size: 14px
  font-weight: 600
  cursor: pointer

.invoice-file__picked
  display: flex
  align-items: center
  gap: 8px
  padding: 10px 12px
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.invoice-file__icon
  flex-shrink: 0
  color: var(--color-primary)

.invoice-file__name
  flex: 1
  min-width: 0
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  font-size: 13.5px
  color: var(--color-text)

.invoice-file__size
  flex-shrink: 0
  font-size: 11.5px
  color: var(--color-text-secondary)
  font-variant-numeric: tabular-nums

.invoice-file__clear
  flex-shrink: 0
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

.invoice-file__error
  margin: 0 0 0 12px
  font-size: 11.5px
  color: #d92d20

.invoice-file__limit
  margin: 0 0 0 12px
  font-size: 11.5px
  color: var(--color-text-secondary)
</style>
