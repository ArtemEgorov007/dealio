<script setup lang="ts">
import {createSupplyRequest, fetchSupplyCatalog} from '~/utils/erp-supply'
import type {ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {rankByQuery, resolveSingleMatch} from '~/utils/text-search'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Снабжение | ERP'})

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

// Подсказка открыта максимум у одной строки: иначе на телефоне списки
// наезжают друг на друга и непонятно, к какой позиции они относятся.
const activeSuggestRow = ref<number | null>(null)
const isSubmitting = ref(false)

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

/**
 * Что показать в списке под строкой.
 *
 * Пустой ввод даёт всю номенклатуру: сотрудник не обязан угадывать
 * формулировку, чтобы вообще увидеть, что бывает на складе. Список
 * прокручивается, поэтому обрезать его не нужно.
 */
const suggestionsFor = (row: FormRow): ErpSupplyCatalogItem[] =>
    rankByQuery(catalog.value, row.name, item => item.name)

const isFromCatalog = (name: string): boolean =>
    catalog.value.some(item => item.name === name.trim())

const categoryFor = (name: string): string =>
    catalog.value.find(item => item.name === name.trim())?.category ?? ''

/**
 * Подставляет позицию номенклатуры по тому, что набрал сотрудник.
 *
 * Заявка принимается только с позицией из справочника, поэтому набранное
 * «каска» нужно превратить в «Каска защитная» самим, а не отбивать ошибкой.
 * Если подходящих несколько — оставляем как есть и показываем список:
 * «Круг отрезной 125» и «Круг отрезной 230» — разные вещи.
 */
const resolveRow = (row: FormRow) => {
    if (!row.name.trim() || isFromCatalog(row.name)) return
    const match = resolveSingleMatch(catalog.value, row.name, item => item.name)
    if (match) row.name = match.name
}

const closeSuggestions = (row: FormRow) => {
    resolveRow(row)
    if (activeSuggestRow.value === row.id) activeSuggestRow.value = null
}

const toggleSuggestions = (row: FormRow) => {
    activeSuggestRow.value = activeSuggestRow.value === row.id ? null : row.id
}

/** Строки, где набрано что-то не из номенклатуры: заявку с ними не примут. */
const unresolvedRows = computed(() =>
    rows.value.filter(row => row.name.trim() && !isFromCatalog(row.name)),
)

const addRow = () => {
    rows.value.push({id: nextRowId++, name: '', quantity: ''})
}

const removeRow = (id: number) => {
    // Последнюю строку не убираем: форма осталась бы без единого поля ввода.
    if (rows.value.length <= 1) return
    rows.value = rows.value.filter(row => row.id !== id)
}

const pickSuggestion = (row: FormRow, item: ErpSupplyCatalogItem) => {
    row.name = item.name
    activeSuggestRow.value = null
}

const filledRows = computed(() =>
    rows.value.filter(row => row.name.trim() && parseQuantity(row.quantity) > 0),
)

// Кнопку не блокируем из-за неразобранной строки: сотрудник должен видеть
// подсказку под конкретной строкой, а не гадать, почему «Заказать» не жмётся.
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
      title="Снабжение"
      subtitle="Заявка на материалы"
      icon="heroicons:truck"
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
              <div class="supply-field">
                <input
                    v-model="row.name"
                    type="text"
                    class="supply-input"
                    placeholder="Номенклатура"
                    autocomplete="off"
                    @focus="activeSuggestRow = row.id"
                    @blur="closeSuggestions(row)"
                >
                <button
                    type="button"
                    class="supply-field__toggle"
                    :aria-label="activeSuggestRow === row.id ? 'Скрыть номенклатуру' : 'Показать всю номенклатуру'"
                    @mousedown.prevent="toggleSuggestions(row)"
                >
                  <Icon
                      name="heroicons:chevron-down"
                      size="16"
                      :class="{'supply-field__toggle-icon--open': activeSuggestRow === row.id}"
                  />
                </button>
              </div>

              <span v-if="categoryFor(row.name)" class="supply-row__category">
                {{ categoryFor(row.name) }}
              </span>
              <span
                  v-else-if="row.name.trim() && activeSuggestRow !== row.id"
                  class="supply-row__hint"
              >
                Выберите позицию из номенклатуры
              </span>

              <div
                  v-if="activeSuggestRow === row.id && suggestionsFor(row).length > 0"
                  class="supply-suggest"
              >
                <button
                    v-for="item in suggestionsFor(row)"
                    :key="item.name"
                    type="button"
                    class="supply-suggest__item"
                    @mousedown.prevent="pickSuggestion(row, item)"
                >
                  <span class="supply-suggest__name">{{ item.name }}</span>
                  <span class="supply-suggest__category">{{ item.category }}</span>
                </button>
              </div>
              <p
                  v-else-if="activeSuggestRow === row.id && row.name.trim()"
                  class="supply-suggest supply-suggest--empty"
              >
                Ничего не нашлось. Очистите поле, чтобы увидеть всю номенклатуру.
              </p>
            </div>

            <input
                v-model="row.quantity"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                class="supply-input supply-input--qty"
                placeholder="Кол-во"
                @focus="activeSuggestRow = null"
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

.supply-row__name
  position: relative
  min-width: 0

.supply-input
  width: 100%
  padding: 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  font-size: 15px
  color: var(--color-text)

  &::placeholder
    color: var(--color-text-secondary)

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.supply-field .supply-input
  // Место под кнопку раскрытия списка, иначе длинное название заезжает под неё.
  padding-right: 36px

.supply-input--qty
  text-align: right
  font-variant-numeric: tabular-nums

.supply-field
  position: relative

.supply-field__toggle
  position: absolute
  top: 0
  right: 0
  display: flex
  align-items: center
  justify-content: center
  width: 34px
  height: 100%
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

  svg
    transition: transform 0.15s ease

.supply-field__toggle-icon--open
  transform: rotate(180deg)

.supply-row__category
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--color-text-secondary)

.supply-row__hint
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--erp-warn, #E7920B)

.supply-row__remove
  flex-shrink: 0
  width: 32px
  height: 40px
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

.supply-suggest
  position: absolute
  top: calc(100% + 4px)
  left: 0
  right: 0
  z-index: 20
  // Список открывается целиком, без обрезки: сотрудник должен видеть всю
  // номенклатуру, а не первые несколько строк.
  max-height: 260px
  overflow-y: auto
  overscroll-behavior: contain
  -webkit-overflow-scrolling: touch
  background: var(--color-card-bg)
  border-radius: 12px
  box-shadow: 0 8px 24px -8px rgba(1, 110, 215, 0.35)

.supply-suggest--empty
  margin: 0
  padding: 10px 12px
  font-size: 12.5px
  color: var(--color-text-secondary)

.supply-suggest__item
  display: flex
  flex-direction: column
  gap: 1px
  width: 100%
  padding: 9px 12px
  border: none
  background: none
  text-align: left
  cursor: pointer
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12)

  &:last-child
    border-bottom: none

  &:hover
    background: var(--color-primary-light)

.supply-suggest__name
  font-size: 14px
  color: var(--color-text)

.supply-suggest__category
  font-size: 11px
  color: var(--color-text-secondary)

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
