<script setup lang="ts">
import {createSupplyRequest, fetchSupplyCatalog} from '~/utils/erp-supply'
import type {ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {useAppToast} from '~/composables/useAppToast'
import type {ErpComboboxOption} from '~/components/erp/ErpCombobox.vue'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Заказ снабжения | ERP'})

const {showSuccess, showError} = useAppToast()
const router = useRouter()

const catalog = ref<ErpSupplyCatalogItem[]>([])
const isLoading = ref(true)
const loadError = ref('')

interface FormRow {
    id: number
    name: string
    // v-model на <input type="number"> отдаёт число, а на пустом поле —
    // пустую строку, поэтому тип честно допускает оба варианта.
    quantity: string | number
}

/** Количество из поля ввода. Запятая — потому что её ставит русская раскладка. */
const parseQuantity = (value: string | number): number =>
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

let nextRowId = 1
const rows = ref<FormRow[]>([{id: nextRowId++, name: '', quantity: ''}])
const isSubmitting = ref(false)

// Поля количества по id строки: после выбора позиции фокус уходит туда —
// следующий шаг всегда один, и не надо целиться в узкое поле.
const quantityEls = new Map<number, HTMLInputElement>()

const setQuantityEl = (id: number, el: unknown) => {
    if (el instanceof HTMLInputElement) quantityEls.set(id, el)
    else quantityEls.delete(id)
}

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        catalog.value = await fetchSupplyCatalog()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить номенклатуру')
    } finally {
        isLoading.value = false
    }
}

const options = computed<ErpComboboxOption[]>(() =>
    catalog.value.map(item => ({value: item.name, hint: item.category})),
)

const categoryFor = (name: string): string =>
    catalog.value.find(item => item.name === name.trim())?.category ?? ''

const isFromCatalog = (name: string): boolean =>
    catalog.value.some(item => item.name === name.trim())

const addRow = () => {
    rows.value.push({id: nextRowId++, name: '', quantity: ''})
}

const removeRow = (id: number) => {
    // Последнюю строку не убираем: форма осталась бы без единого поля ввода.
    if (rows.value.length <= 1) return
    rows.value = rows.value.filter(row => row.id !== id)
}

const onPicked = (row: FormRow) => {
    nextTick(() => quantityEls.get(row.id)?.focus())
}

const filledRows = computed(() =>
    rows.value.filter(row => row.name.trim() && parseQuantity(row.quantity) > 0),
)

/** Строки, где набрано что-то не из номенклатуры: заявку с ними не примут. */
const unresolvedRows = computed(() =>
    rows.value.filter(row => row.name.trim() && !isFromCatalog(row.name)),
)

// Кнопку блокируем, но подсказка стоит под конкретной строкой — сотрудник
// должен видеть причину, а не гадать, почему «Заказать» не жмётся.
const canSubmit = computed(() =>
    filledRows.value.length > 0 && unresolvedRows.value.length === 0 && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        const result = await createSupplyRequest(
            filledRows.value.map(row => ({
                name: row.name.trim(),
                quantity: parseQuantity(row.quantity),
            })),
        )
        showSuccess(`Заявка ${result.requestCode} создана`, `Позиций: ${result.positions}`)
        rows.value = [{id: nextRowId++, name: '', quantity: ''}]
    } catch (error) {
        showError(error, 'Не удалось создать заявку')
    } finally {
        isSubmitting.value = false
    }
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Заказ снабжения"
      subtitle="Заявка на материалы"
      icon="heroicons:clipboard-document-check"
      :shift-link="{label: 'Ваши заявки', icon: 'heroicons:clipboard-document-list', onClick: () => router.push('/supply-requests')}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка номенклатуры…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Позиции заявки</ErpSectionLabel>

      <div class="supply-rows">
        <div v-for="row in rows" :key="row.id" class="supply-row">
          <div class="supply-row__fields">
            <div class="supply-row__name">
              <ErpCombobox
                  v-model="row.name"
                  :options="options"
                  placeholder="Номенклатура"
                  unresolved-hint="Выберите позицию из номенклатуры"
                  @picked="onPicked(row)"
              />
              <span v-if="categoryFor(row.name)" class="supply-row__category">
                {{ categoryFor(row.name) }}
              </span>
            </div>

            <input
                :ref="el => setQuantityEl(row.id, el)"
                v-model="row.quantity"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                class="supply-input supply-input--qty"
                placeholder="Кол-во"
            >
          </div>

          <button
              v-if="rows.length > 1"
              type="button"
              class="supply-row__remove"
              aria-label="Убрать позицию"
              @click="removeRow(row.id)"
          >
            <Icon name="heroicons:x-mark" size="15"/>
          </button>
        </div>
      </div>

      <button type="button" class="supply-add" aria-label="Добавить позицию" @click="addRow">
        <Icon name="heroicons:plus" size="18"/>
      </button>
    </template>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">
        Заказать
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.supply-rows
  display: flex
  flex-direction: column
  gap: 8px

.supply-row
  display: flex
  align-items: flex-start
  gap: 6px

.supply-row__fields
  flex: 1
  display: grid
  // Номенклатура занимает основную ширину, количество — узкая колонка справа,
  // как в бумажной заявке.
  grid-template-columns: 1fr 92px
  gap: 6px
  min-width: 0
  // Колонки выравниваем по верху. По умолчанию сетка растягивает ячейки на
  // всю высоту строки, и после выбора позиции — когда под номенклатурой
  // появляется подпись категории — поле количества вытягивалось с 46 до 65px.
  align-items: start

.supply-row__name
  min-width: 0

.supply-input
  width: 100%
  padding: 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  color: var(--color-text)
  // Размер шрифта намеренно не задан: erp-theme.css держит все поля ввода
  // на 16px через !important, иначе iOS Safari зумирует страницу при фокусе.

  &::placeholder
    color: var(--color-text-secondary)
    // На плейсхолдер запрет не распространяется — зум зависит от размера
    // самого поля. Уменьшаем до размера заголовка «Позиции заявки».
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.supply-input--qty
  text-align: right
  font-variant-numeric: tabular-nums

.supply-row__category
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--color-text-secondary)

.supply-row__remove
  flex-shrink: 0
  width: 32px
  height: 40px
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

.supply-add
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
