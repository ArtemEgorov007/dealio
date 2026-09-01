<script setup lang="ts">
import {fetchContract, saveContractRates} from '~/utils/erp-contracts'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Расценки договора | ERP'})

const route = useRoute()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const contractId = computed(() => Number(route.query.id ?? 0))
const internalNumber = ref('')
const isLoading = ref(true)
const loadError = ref('')
const isSubmitting = ref(false)

interface RateRow {
    /** Ключ для v-for: у новых строк своего id ещё нет. */
    key: number
    /** id расценки в базе. Ноль — строка ещё не сохранялась. */
    id: number
    param1: string
    param2: string
    param3: string
    param4: string
    priceM2: string
    priceTon: string
}

let nextKey = 1
const emptyRow = (): RateRow => ({
    key: nextKey++, id: 0, param1: '', param2: '', param3: '', param4: '', priceM2: '', priceTon: '',
})

const rows = ref<RateRow[]>([emptyRow()])

// Расценка, ради которой пришли с карточки договора: подсвечиваем её и
// подводим экран к ней, иначе в длинном списке непонятно, что открылось.
const focusedRateId = computed(() => Number(route.query.rate ?? 0))
const rateEls = new Map<number, HTMLElement>()

const setRateEl = (id: number, el: unknown) => {
    if (el instanceof HTMLElement) rateEls.set(id, el)
    else rateEls.delete(id)
}

/** Пустое значение показываем пустым полем: прочерк и ноль — это «не задано». */
const editable = (value: string): string => value === '-' ? '' : value
const editablePrice = (value: number): string => value === 0 ? '' : String(value).replace('.', ',')

const load = async () => {
    if (!contractId.value) {
        loadError.value = 'Договор не выбран'
        isLoading.value = false
        return
    }
    isLoading.value = true
    loadError.value = ''
    try {
        const data = await fetchContract(contractId.value)
        internalNumber.value = data.contract.internalNumber
        // Экран правит набор целиком, поэтому и открываем его целиком.
        rows.value = data.rates.length
            ? data.rates.map(rate => ({
                key: nextKey++,
                id: rate.id,
                param1: editable(rate.param1),
                param2: editable(rate.param2),
                param3: editable(rate.param3),
                param4: editable(rate.param4),
                priceM2: editablePrice(rate.priceM2),
                priceTon: editablePrice(rate.priceTon),
            }))
            : [emptyRow()]

        if (focusedRateId.value) {
            await nextTick()
            rateEls.get(focusedRateId.value)?.scrollIntoView({block: 'center', behavior: 'smooth'})
        }
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить расценки')
    } finally {
        isLoading.value = false
    }
}

const addRow = () => {
    rows.value.push(emptyRow())
}

/**
 * Удаление расценки.
 *
 * Из базы она исчезнет при сохранении: сервер удаляет те строки, которых нет
 * в присланном наборе. Отдельный запрос на удаление разошёлся бы с правками
 * остальных строк, если бы одна из двух операций не дошла.
 */
const removeRow = (key: number) => {
    // Последнюю строку не убираем: экран остался бы без единого поля ввода.
    if (rows.value.length <= 1) {
        rows.value = [emptyRow()]
        return
    }
    rows.value = rows.value.filter(row => row.key !== key)
}

const hasContent = (row: RateRow): boolean =>
    row.id !== 0
    || [row.param1, row.param2, row.param3, row.param4, row.priceM2, row.priceTon].some(v => v.trim() !== '')

// Незаполненные поля не запрещены: параметр сохранится прочерком, цена нулём.
// Сохранять нечего только тогда, когда не осталось ни одной строки с данными —
// но и это законно: так удаляют последнюю расценку.
const filledRows = computed(() => rows.value.filter(hasContent))

const canSubmit = computed(() => !isSubmitting.value)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        const result = await saveContractRates(
            contractId.value,
            filledRows.value.map(row => ({
                id: row.id,
                param1: row.param1.trim(),
                param2: row.param2.trim(),
                param3: row.param3.trim(),
                param4: row.param4.trim(),
                priceM2: row.priceM2,
                priceTon: row.priceTon,
            })),
        )
        showSuccess(
            'Расценки сохранены',
            result.removed ? `Строк: ${result.saved}, удалено: ${result.removed}` : `Строк: ${result.saved}`,
        )
        await router.push({path: '/contract', query: {id: contractId.value}})
    } catch (error) {
        showError(error, 'Не удалось сохранить расценки')
    } finally {
        isSubmitting.value = false
    }
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Расценки"
      :subtitle="internalNumber ? `Договор ${internalNumber}` : 'Договор'"
      icon="heroicons:calculator"
      :shift-link="{label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13, onClick: () => router.push({path: '/contract', query: {id: contractId}})}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="router.push('/contracts')">К списку договоров</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Расценки договора</ErpSectionLabel>
      <p class="rates__note">Правки применятся к договору после нажатия «Внести»</p>

      <div class="rates">
        <section
            v-for="(row, index) in rows"
            :key="row.key"
            :ref="el => setRateEl(row.id, el)"
            class="rate"
            :class="{'rate--focused': row.id !== 0 && row.id === focusedRateId}"
        >
          <header class="rate__head">
            <span class="rate__index">Расценка {{ index + 1 }}</span>
            <button
                type="button"
                class="rate__remove"
                :aria-label="row.id ? 'Удалить расценку' : 'Убрать строку'"
                @click="removeRow(row.key)"
            >
              <Icon name="heroicons:trash" size="15"/>
            </button>
          </header>

          <div class="rate__params">
            <input v-model="row.param1" type="text" class="rate__input" placeholder="Параметр 1">
            <input v-model="row.param2" type="text" class="rate__input" placeholder="Параметр 2">
            <input v-model="row.param3" type="text" class="rate__input" placeholder="Параметр 3">
            <input v-model="row.param4" type="text" class="rate__input" placeholder="Параметр 4">
          </div>

          <div class="rate__prices">
            <label class="rate__price">
              <span class="rate__price-label">Цена за м²</span>
              <input v-model="row.priceM2" type="text" inputmode="decimal" class="rate__input rate__input--num" placeholder="0,00">
            </label>
            <label class="rate__price">
              <span class="rate__price-label">Цена за тн</span>
              <input v-model="row.priceTon" type="text" inputmode="decimal" class="rate__input rate__input--num" placeholder="0,00">
            </label>
          </div>

          <p class="rate__hint">
            Пустой параметр сохранится прочерком, пустая цена — нулём
          </p>
        </section>
      </div>

      <button type="button" class="rates__add" aria-label="Добавить расценку" @click="addRow">
        <Icon name="heroicons:plus" size="18"/>
      </button>
    </template>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">Внести</UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.rates__note
  margin: 0 0 2px 12px
  font-size: 11px
  color: var(--color-text-secondary)

.rates
  display: flex
  flex-direction: column
  gap: 10px

.rate
  padding: 12px
  background: var(--color-card-bg)
  border-radius: 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.rate__head
  display: flex
  align-items: center
  justify-content: space-between
  margin-bottom: 8px

.rate__index
  font-size: 11px
  font-weight: 700
  letter-spacing: 0.2px
  text-transform: uppercase
  color: var(--color-text-secondary)

.rate__remove
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

.rate__params
  display: grid
  // Параметры попарно: на 390px четыре поля в столбик занимают весь экран.
  grid-template-columns: 1fr 1fr
  gap: 6px

.rate__prices
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 6px
  margin-top: 8px

.rate__price
  display: block
  min-width: 0

.rate__price-label
  display: block
  margin: 0 0 3px 10px
  font-size: 10.5px
  font-weight: 600
  letter-spacing: 0.2px
  text-transform: uppercase
  color: var(--color-text-secondary)

.rate__input
  width: 100%
  padding: 10px 11px
  border: none
  border-radius: 10px
  background: var(--color-bg, #EAF2FD)
  color: var(--color-text)
  // Размер шрифта не задаём: erp-theme.css держит поля на 16px против зума iOS.

  &::placeholder
    color: var(--color-text-secondary)
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.rate__input--num
  text-align: right
  font-variant-numeric: tabular-nums

.rate--focused
  outline: 2px solid var(--color-primary)
  outline-offset: 2px

.rate__hint
  margin: 8px 0 0 10px
  font-size: 11px
  color: var(--color-text-secondary)

.rates__add
  align-self: center
  display: flex
  align-items: center
  justify-content: center
  width: 40px
  height: 40px
  margin-top: 10px
  border: none
  border-radius: 50%
  background: var(--color-primary-light)
  color: var(--color-primary)
  cursor: pointer
</style>
