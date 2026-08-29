<script setup lang="ts">
import {fetchWarehouseItems, receiveWarehouseItem} from '~/utils/warehouse-sheets'
import {WAREHOUSE_UNITS, WAREHOUSE_TYPES} from '~~/types/warehouse.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useAppToast} from '~/composables/useAppToast'
import {useIdempotencyKey} from '~/composables/useIdempotencyKey'
import {useWarehouseCatalog} from '~/composables/useWarehouseCatalog'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приём | ERP'})

const employeeStore = useErpEmployeeStore()
const {showSuccess} = useAppToast()
const {requestIdFor, reset: resetRequestId} = useIdempotencyKey()

const {
    categories,
    categoriesLoading,
    categoriesError,
    loadCategories,
    selectedCategory,
    selectCategory,
    items,
    itemsLoading,
    itemsError,
    itemsSectionRef,
    retryItems,
    query,
    filteredItems,
} = useWarehouseCatalog<string>({
    loadItems: category => fetchWarehouseItems(category),
    itemsErrorMessage: 'Ошибка загрузки товаров',
    searchSelector: item => item,
})

onMounted(loadCategories)

// Лист приёма — выезжающая снизу шторка (ErpActionSheet) поверх списка,
// не отдельный роут: список остаётся под шторкой, как в макете.
const sheetItem = ref<string | null>(null)
const qty = ref('')
const unit = ref<typeof WAREHOUSE_UNITS[number] | null>(null)
const cell = ref('')
const type = ref<typeof WAREHOUSE_TYPES[number]>('Новый')
const TYPE_OPTIONS = WAREHOUSE_TYPES.map(value => ({value}))
const setType = (value: string) => { type.value = value as typeof WAREHOUSE_TYPES[number] }
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
        resetRequestId()
        sheetItem.value = null
    } catch (error) {
        submitError.value = error instanceof Error ? error.message : 'Не удалось оформить приём'
    } finally {
        isSaving.value = false
    }
}
</script>

<template>
  <ErpScreen
      title="Приём"
      icon="heroicons:arrow-down-tray"
      :subtitle="`Площадка: ${employeeStore.platform}`"
      :shift-link="{ to: '/warehouse', label: 'Склад', icon: 'heroicons:chevron-left', iconSize: 13 }"
  >
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
        <div ref="itemsSectionRef">
          <ErpSearchBar
              v-model="query"
              on-light
              placeholder="Поиск по наименованию"
              :count-label="items.length ? `Найдено ${filteredItems.length} из ${items.length}` : ''"
          />
        </div>

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
        aria-label="Приём товара"
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
          <UiSegmentedControl :model-value="type" :options="TYPE_OPTIONS" @update:model-value="setType"/>
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
  gap: var(--spacing-3)

:deep(.erp-sheet-label)
  font-size: 12.5px
  font-weight: 600
  color: var(--color-text-secondary)
  text-transform: uppercase
  letter-spacing: 0.3px

:deep(.erp-sheet-card)
  padding: 0
  background: none
  box-shadow: none

:deep(.erp-sheet-content)
  margin-top: 0
  font-size: 16px
  font-weight: 500
  text-align: left
  color: var(--color-text)

:deep(.erp-sheet-actions)
  margin-top: 0

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
</style>
