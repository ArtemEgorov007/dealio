<script setup lang="ts">
import {fetchWarehouseCategories, fetchWarehouseItems} from '~/utils/warehouse-sheets'
import {useErpSessionStore} from '~~/store/erp-session.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приём | ERP'})

const router = useRouter()
const sessionStore = useErpSessionStore()

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
        items.value = await fetchWarehouseItems(category)
    } catch (error) {
        itemsError.value = error instanceof Error ? error.message : 'Ошибка загрузки товаров'
    } finally {
        itemsLoading.value = false
    }
}

const retryItems = () => {
    if (selectedCategory.value) selectCategory(selectedCategory.value)
}

const selectItem = (name: string) => {
    sessionStore.setWarehouseReceiveItem(name)
    router.push('/warehouse-receive-form')
}

onMounted(loadCategories)
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
  </ErpScreen>
</template>
