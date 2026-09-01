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
    id: number
    param1: string
    param2: string
    param3: string
    param4: string
    priceM2: string
    priceTon: string
}

let nextRowId = 1
const emptyRow = (): RateRow => ({
    id: nextRowId++, param1: '', param2: '', param3: '', param4: '', priceM2: '', priceTon: '',
})

const rows = ref<RateRow[]>([emptyRow()])

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
                id: nextRowId++,
                param1: rate.param1,
                param2: rate.param2,
                param3: rate.param3,
                param4: rate.param4,
                priceM2: rate.priceM2 === null ? '' : String(rate.priceM2).replace('.', ','),
                priceTon: rate.priceTon === null ? '' : String(rate.priceTon).replace('.', ','),
            }))
            : [emptyRow()]
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить расценки')
    } finally {
        isLoading.value = false
    }
}

const addRow = () => {
    rows.value.push(emptyRow())
}

const removeRow = (id: number) => {
    // Последнюю строку не убираем: экран остался бы без единого поля ввода.
    if (rows.value.length <= 1) return
    rows.value = rows.value.filter(row => row.id !== id)
}

const hasContent = (row: RateRow): boolean =>
    [row.param1, row.param2, row.param3, row.param4, row.priceM2, row.priceTon].some(v => v.trim() !== '')

const hasPrice = (row: RateRow): boolean => row.priceM2.trim() !== '' || row.priceTon.trim() !== ''

// Расценка без цены — это не расценка. Показываем причину под строкой, а не
// прячем её в отказе сервера после нажатия.
const brokenRows = computed(() => rows.value.filter(row => hasContent(row) && !hasPrice(row)))

const filledRows = computed(() => rows.value.filter(hasContent))

const canSubmit = computed(() =>
    filledRows.value.length > 0 && brokenRows.value.length === 0 && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        const result = await saveContractRates(
            contractId.value,
            filledRows.value.map(row => ({
                param1: row.param1.trim(),
                param2: row.param2.trim(),
                param3: row.param3.trim(),
                param4: row.param4.trim(),
                priceM2: row.priceM2,
                priceTon: row.priceTon,
            })),
        )
        showSuccess('Расценки сохранены', `Строк: ${result.saved}`)
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

      <div class="rates">
        <section v-for="(row, index) in rows" :key="row.id" class="rate">
          <header class="rate__head">
            <span class="rate__index">Расценка {{ index + 1 }}</span>
            <button
                v-if="rows.length > 1"
                type="button"
                class="rate__remove"
                aria-label="Убрать расценку"
                @click="removeRow(row.id)"
            >
              <Icon name="heroicons:x-mark" size="15"/>
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

          <p v-if="hasContent(row) && !hasPrice(row)" class="rate__hint">
            Укажите цену за м² или за тонну
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

.rate__hint
  margin: 8px 0 0 10px
  font-size: 11px
  color: var(--erp-warn, #E7920B)

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
