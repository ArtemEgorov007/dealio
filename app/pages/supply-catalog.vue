<script setup lang="ts">
import {fetchSupplyCatalog} from '~/utils/erp-supply'
import type {ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {filterByQuery} from '~/utils/text-search'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Справочник | ERP'})

const items = ref<ErpSupplyCatalogItem[]>([])
const isLoading = ref(true)
const loadError = ref('')
const query = ref('')

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        items.value = await fetchSupplyCatalog()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить справочник')
    } finally {
        isLoading.value = false
    }
}

const found = computed(() => filterByQuery(items.value, query.value, item => `${item.name} ${item.category}`))

// Группируем по категориям: справочник читают, чтобы понять «что вообще есть»,
// а плоский список из трёхсот строк на этот вопрос не отвечает.
const groups = computed(() => {
    const byCategory = new Map<string, ErpSupplyCatalogItem[]>()
    for (const item of found.value) {
        const category = item.category || 'Без категории'
        const list = byCategory.get(category)
        if (list) list.push(item)
        else byCategory.set(category, [item])
    }
    return [...byCategory.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
        .map(([category, list]) => ({category, items: list}))
})

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Справочник"
      subtitle="Номенклатура склада"
      icon="heroicons:book-open"
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
      <input
          v-model="query"
          type="search"
          class="catalog-search"
          placeholder="Поиск по названию или категории"
          autocomplete="off"
      >

      <p class="catalog-count">
        {{ found.length }} из {{ items.length }} позиций
      </p>

      <ErpEmptyState v-if="found.length === 0">
        <p>Ничего не нашлось</p>
        <UiButton variant="outline" @click="query = ''">Показать всё</UiButton>
      </ErpEmptyState>

      <template v-else>
        <section v-for="group in groups" :key="group.category" class="catalog-group">
          <ErpSectionLabel>{{ group.category }}</ErpSectionLabel>
          <ul class="catalog-list">
            <li v-for="item in group.items" :key="item.name" class="catalog-item">
              {{ item.name }}
            </li>
          </ul>
        </section>
      </template>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.catalog-search
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

.catalog-count
  margin: 6px 0 0 12px
  font-size: 11.5px
  color: var(--color-text-secondary)
  font-variant-numeric: tabular-nums

.catalog-group
  display: flex
  flex-direction: column
  gap: 6px

.catalog-list
  display: flex
  flex-direction: column
  margin: 0
  padding: 0
  list-style: none
  background: var(--color-card-bg)
  border-radius: 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  overflow: hidden

.catalog-item
  padding: 10px 14px
  font-size: 14px
  color: var(--color-text)
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12)

  &:last-child
    border-bottom: none
</style>
