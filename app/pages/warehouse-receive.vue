<script setup lang="ts">
import {fetchWarehouseCategories, fetchWarehouseItems, receiveWarehouseItem} from '~/utils/warehouse-sheets'
import {WAREHOUSE_UNITS, WAREHOUSE_TYPES} from '~~/types/warehouse.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useAppToast} from '~/composables/useAppToast'
import {useIdempotencyKey} from '~/composables/useIdempotencyKey'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приём | ERP'})

const employeeStore = useErpEmployeeStore()
const {showSuccess} = useAppToast()
const {requestIdFor} = useIdempotencyKey()

const categories = ref<string[]>([])
const categoriesLoading = ref(true)
const categoriesError = ref('')

const selectedCategory = ref<string | null>(null)
const items = ref<string[]>([])
const itemsLoading = ref(false)
const itemsError = ref('')
const query = ref('')

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const filteredItems = computed(() => {
    const needle = normalize(query.value)
    if (!needle) return items.value
    return items.value.filter(item => normalize(item).includes(needle))
})

const loadCategories = async () => {
    categoriesLoading.value = true
    categoriesError.value = ''
    try {
        categories.value = await fetchWarehouseCategories()
    } catch (error) {
        categoriesError.value = error instanceof Error ? error.message : 'Ошибка загрузки категорий'
    } finally {
        categoriesLoading.value = false
    }
}

const selectCategory = async (category: string) => {
    selectedCategory.value = category
    query.value = ''
    itemsLoading.value = true
    itemsError.value = ''
    try {
        const fetchedItems = await fetchWarehouseItems(category)
        // Guard against stale responses: only write if this category is still selected
        if (selectedCategory.value === category) {
            items.value = fetchedItems
        }
    } catch (error) {
        // Guard against stale responses: only write error if this category is still selected
        if (selectedCategory.value === category) {
            itemsError.value = error instanceof Error ? error.message : 'Ошибка загрузки товаров'
        }
    } finally {
        // Guard against stale responses: only clear loading state if this category is still selected
        if (selectedCategory.value === category) {
            itemsLoading.value = false
        }
    }
}

const retryItems = () => {
    if (selectedCategory.value) selectCategory(selectedCategory.value)
}

onMounted(loadCategories)

// Лист приёма — выезжающая снизу шторка (ErpActionSheet) поверх списка,
// не отдельный роут: список остаётся под шторкой, как в макете.
const sheetItem = ref<string | null>(null)
const qty = ref('')
const unit = ref<typeof WAREHOUSE_UNITS[number] | null>(null)
const cell = ref('')
const type = ref<typeof WAREHOUSE_TYPES[number]>('Новый')
const isSaving = ref(false)
const submitError = ref('')

const qtyError = computed(() => {
    const trimmed = qty.value.trim()
    if (!trimmed) return ''
    return /^\d+$/.test(trimmed) ? '' : 'Только целые числа'
})

const canSubmit = computed(() =>
    !isSaving.value
    && qty.value.trim() !== ''
    && !qtyError.value
    && unit.value !== null
    && cell.value.trim() !== '',
)

const selectItem = (name: string) => {
    sheetItem.value = name
    qty.value = ''
    unit.value = null
    cell.value = ''
    type.value = 'Новый'
    submitError.value = ''
}

const closeSheet = () => {
    if (isSaving.value) return
    sheetItem.value = null
}

const submit = async () => {
    if (!canSubmit.value || !sheetItem.value) return

    isSaving.value = true
    submitError.value = ''

    const fingerprint = JSON.stringify([cell.value.trim(), sheetItem.value, type.value, qty.value.trim(), unit.value])
    const requestId = requestIdFor(fingerprint)

    try {
        await receiveWarehouseItem({
            platform: employeeStore.platform,
            cell: cell.value.trim(),
            name: sheetItem.value,
            type: type.value,
            qty: parseInt(qty.value, 10),
            unit: unit.value!,
            fio: employeeStore.fio,
            requestId,
        })
        showSuccess('Товар принят', sheetItem.value)
        sheetItem.value = null
    } catch (error) {
        submitError.value = error instanceof Error ? error.message : 'Не удалось оформить приём'
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
  <ErpScreen title="Приём" icon="heroicons:arrow-down-tray">
    <ErpEmptyState v-if="categoriesLoading" loading>
      <span>Загрузка категорий…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="categoriesError" error>
      <p>{{ categoriesError }}</p>
      <UiButton variant="outline" @click="loadCategories">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Категория</ErpSectionLabel>
      <WarehouseCategoryGrid
          :categories="categories"
          :selected="selectedCategory"
          @select="selectCategory"
      />

      <template v-if="selectedCategory">
        <ErpSearchBar
            v-model="query"
            on-light
            placeholder="Поиск по наименованию"
            :count-label="items.length ? `Найдено ${filteredItems.length} из ${items.length}` : ''"
        />

        <ErpEmptyState v-if="itemsLoading" loading>
          <span>Загрузка…</span>
        </ErpEmptyState>

        <ErpEmptyState v-else-if="itemsError" error>
          <p>{{ itemsError }}</p>
          <UiButton variant="outline" @click="retryItems">Повторить</UiButton>
        </ErpEmptyState>

        <ErpEmptyState v-else-if="items.length === 0">
          <p>Для категории «{{ selectedCategory }}» товары не найдены</p>
        </ErpEmptyState>

        <ErpEmptyState v-else-if="filteredItems.length === 0">
          <p>Ничего не найдено по запросу «{{ query }}»</p>
          <UiButton variant="outline" @click="query = ''">Очистить поиск</UiButton>
        </ErpEmptyState>

        <ErpGroupedList v-else>
          <ErpListRow
              v-for="item in filteredItems"
              :key="item"
              chevron
              @click="selectItem(item)"
          >
            {{ item }}
          </ErpListRow>
        </ErpGroupedList>
      </template>
    </template>

    <ErpActionSheet
        :open="!!sheetItem"
        :busy="isSaving"
        ariaLabel="Приём товара"
        @dismiss="closeSheet"
    >
      <template #label>Приём товара</template>
      <template #content>{{ sheetItem }}</template>
      <template v-if="submitError" #error>{{ submitError }}</template>
      <template #form>
        <div class="wh-sheet-field">
          <p class="wh-sheet-field__label">Количество</p>
          <UiInput id="receive-qty" v-model="qty" inputmode="numeric" :error="qtyError"/>
        </div>

        <div class="wh-sheet-field">
          <p class="wh-sheet-field__label">Ед. изм.</p>
          <div class="wh-chip-row">
            <button
                v-for="opt in WAREHOUSE_UNITS"
                :key="opt"
                type="button"
                class="wh-chip"
                :class="{ 'wh-chip--active': unit === opt }"
                @click="unit = opt"
            >
              {{ opt }}
            </button>
          </div>
        </div>

        <div class="wh-sheet-field">
          <p class="wh-sheet-field__label">Ячейка хранения</p>
          <UiInput id="receive-cell" v-model="cell"/>
        </div>

        <div class="wh-sheet-field">
          <p class="wh-sheet-field__label">Тип</p>
          <div class="wh-toggle-row">
            <button
                v-for="opt in WAREHOUSE_TYPES"
                :key="opt"
                type="button"
                class="wh-toggle-opt"
                :class="{ 'wh-toggle-opt--active': type === opt }"
                @click="type = opt"
            >
              {{ opt }}
            </button>
          </div>
        </div>
      </template>
      <template #actions>
        <UiButton block :loading="isSaving" :disabled="!canSubmit" @click="submit">
          Принять
        </UiButton>
      </template>
    </ErpActionSheet>
  </ErpScreen>
</template>

<style scoped lang="sass">
/* Локальный вид шторки под макет Приёма/Выдачи (белый фон, жирный лейбл,
   название товара — обычный подзаголовок, не карточка) — только на этих
   двух экранах, остальные ErpActionSheet (подтверждение бирки и т.п.)
   не трогаем */
:deep(.erp-sheet-panel)
  background-color: var(--color-card-bg)

:deep(.erp-sheet-label)
  font-size: 15px
  font-weight: 800
  color: var(--color-text)

:deep(.erp-sheet-card)
  padding: 0
  background: none
  box-shadow: none

:deep(.erp-sheet-content)
  margin-top: -6px
  font-size: 13px
  font-weight: 400
  text-align: left
  color: var(--color-text-secondary)

.wh-sheet-field
  display: flex
  flex-direction: column
  gap: var(--spacing-2)

.wh-sheet-field__label
  margin: 0 0 0 4px
  font-size: 13px
  font-weight: 500
  color: var(--color-text-secondary)
  text-transform: uppercase
  letter-spacing: 0.3px

.wh-chip-row
  display: flex
  gap: 6px
  flex-wrap: wrap

.wh-chip
  padding: 7px 13px
  border-radius: 999px
  font-size: 13px
  font-weight: 600
  background: var(--color-bg)
  border: 1px solid var(--color-border)
  color: var(--color-text-secondary)
  cursor: pointer

  &--active
    background: var(--color-primary)
    border-color: var(--color-primary)
    color: #fff

.wh-toggle-row
  display: flex
  gap: 2px
  background: var(--color-bg)
  border-radius: 9px
  padding: 2px

.wh-toggle-opt
  flex: 1
  padding: 7px 8px
  border: none
  border-radius: 7px
  background: transparent
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 500
  cursor: pointer

  &--active
    background: var(--color-card-bg)
    color: var(--color-text)
    font-weight: 600
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0.5px 1px rgba(0, 0, 0, 0.06)
</style>
