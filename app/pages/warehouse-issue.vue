<script setup lang="ts">
import {fetchWarehouseCategories, fetchWarehouseStock} from '~/utils/warehouse-sheets'
import type {WarehouseStockItem} from '~~/types/warehouse.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Выдача | ERP'})

const employeeStore = useErpEmployeeStore()
const sessionStore = useErpSessionStore()
const router = useRouter()

const categories = ref<string[]>([])
const categoriesLoading = ref(true)
const categoriesError = ref('')

const selectedCategory = ref<string | null>(null)
const stockItems = ref<WarehouseStockItem[]>([])
const itemsLoading = ref(false)
const itemsError = ref('')
const query = ref('')

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const filteredItems = computed(() => {
    const needle = normalize(query.value)
    if (!needle) return stockItems.value
    return stockItems.value.filter(item => normalize(item.name).includes(needle))
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
        const fetchedItems = await fetchWarehouseStock(employeeStore.platform, category)
        // Guard against stale responses: only write if this category is still selected
        if (selectedCategory.value === category) {
            stockItems.value = fetchedItems
        }
    } catch (error) {
        // Guard against stale responses: only write error if this category is still selected
        if (selectedCategory.value === category) {
            itemsError.value = error instanceof Error ? error.message : 'Ошибка загрузки остатков'
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

const selectItem = (item: WarehouseStockItem) => {
    sessionStore.setWarehouseIssueItem(item)
    router.push('/warehouse-issue-form')
}

onMounted(loadCategories)
</script>

<template>
  <ErpScreen title="Выдача" icon="heroicons:arrow-up-tray">
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
            placeholder="Поиск по наименованию"
            :count-label="stockItems.length ? `Найдено ${filteredItems.length} из ${stockItems.length}` : ''"
        />

        <ErpEmptyState v-if="itemsLoading" loading>
          <span>Загрузка…</span>
        </ErpEmptyState>

        <ErpEmptyState v-else-if="itemsError" error>
          <p>{{ itemsError }}</p>
          <UiButton variant="outline" @click="retryItems">Повторить</UiButton>
        </ErpEmptyState>

        <ErpEmptyState v-else-if="stockItems.length === 0">
          <p>Для категории «{{ selectedCategory }}» остатков на вашей площадке нет</p>
        </ErpEmptyState>

        <ErpEmptyState v-else-if="filteredItems.length === 0">
          <p>Ничего не найдено по запросу «{{ query }}»</p>
          <UiButton variant="outline" @click="query = ''">Очистить поиск</UiButton>
        </ErpEmptyState>

        <ErpGroupedList v-else>
          <ErpListRow
              v-for="item in filteredItems"
              :key="`${item.cell}-${item.name}-${item.type}`"
              chevron
              multiline
              @click="selectItem(item)"
          >
            <span class="wh-issue-row">
              <span class="wh-issue-row__name">{{ item.name }}</span>
              <span class="wh-issue-row__meta">Ячейка {{ item.cell }} · {{ item.type }}</span>
            </span>
            <template #trailing>
              <span class="wh-stock-pill">{{ item.balance }} {{ item.unit }}</span>
            </template>
          </ErpListRow>
        </ErpGroupedList>
      </template>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.wh-issue-row
  display: flex
  flex-direction: column
  gap: 2px
  min-width: 0

.wh-issue-row__name
  font-size: 15px
  font-weight: 600

.wh-issue-row__meta
  font-size: 12px
  color: var(--color-text-secondary)

.wh-stock-pill
  font-size: 12px
  font-weight: 700
  padding: 3px 9px
  border-radius: 999px
  background: rgba(30, 138, 76, 0.12)
  color: #1E8A4C
  flex-shrink: 0
  white-space: nowrap
</style>
