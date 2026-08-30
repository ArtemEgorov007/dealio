<script setup lang="ts">
import {createSupplyRequest, fetchSupplyCatalog} from '~/utils/erp-supply'
import type {ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {filterByQuery} from '~/utils/text-search'
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
    quantity: string
}

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

const suggestionsFor = (row: FormRow): ErpSupplyCatalogItem[] => {
    if (!row.name.trim()) return []
    // Больше восьми подсказок на телефоне не помещается и мешает вводу.
    return filterByQuery(catalog.value, row.name, item => item.name).slice(0, 8)
}

const categoryFor = (name: string): string =>
    catalog.value.find(item => item.name === name)?.category ?? ''

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
    rows.value.filter(row => row.name.trim() && Number(row.quantity.replace(',', '.')) > 0),
)

const canSubmit = computed(() => filledRows.value.length > 0 && !isSubmitting.value)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        const result = await createSupplyRequest(
            filledRows.value.map(row => ({
                name: row.name.trim(),
                quantity: Number(row.quantity.replace(',', '.')),
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
              <input
                  v-model="row.name"
                  type="text"
                  class="supply-input"
                  placeholder="Номенклатура"
                  autocomplete="off"
                  @focus="activeSuggestRow = row.id"
              >
              <span v-if="categoryFor(row.name)" class="supply-row__category">
                {{ categoryFor(row.name) }}
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

.supply-suggest
  position: absolute
  top: calc(100% + 4px)
  left: 0
  right: 0
  z-index: 20
  background: var(--color-card-bg)
  border-radius: 12px
  box-shadow: 0 8px 24px -8px rgba(1, 110, 215, 0.35)
  overflow: hidden

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
