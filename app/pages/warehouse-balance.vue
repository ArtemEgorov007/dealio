<script setup lang="ts">
import {fetchWarehouseStock, fetchWarehousePlatforms} from '~/utils/warehouse-sheets'
import type {WarehouseStockItem} from '~~/types/warehouse.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {filterByQuery} from '~/utils/text-search'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Баланс | ERP'})

const employeeStore = useErpEmployeeStore()

const isOffice = computed(() => employeeStore.platform === 'Офис')

const selectedPlatform = ref(employeeStore.platform)
const platforms = ref<string[]>([])
const isPickerOpen = ref(false)

const items = ref<WarehouseStockItem[]>([])
const isLoading = ref(true)
const error = ref('')
const query = ref('')

const filteredItems = computed(() => filterByQuery(items.value, query.value, item => item.name))

const load = async () => {
    isLoading.value = true
    error.value = ''
    try {
        items.value = await fetchWarehouseStock(selectedPlatform.value)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки остатков'
    } finally {
        isLoading.value = false
    }
}

const loadPlatforms = async () => {
    if (!isOffice.value) return
    try {
        platforms.value = await fetchWarehousePlatforms()
    } catch {
        platforms.value = []
    }
}

const selectPlatform = (platform: string) => {
    selectedPlatform.value = platform
    isPickerOpen.value = false
    query.value = ''
    load()
}

onMounted(() => {
    load()
    loadPlatforms()
})
</script>

<template>
  <ErpScreen
      title="Баланс"
      icon="heroicons:scale"
      :shift-link="{ to: '/warehouse', label: 'Склад', icon: 'heroicons:chevron-left', iconSize: 13 }"
  >
    <button
        v-if="isOffice && platforms.length > 0"
        type="button"
        class="wh-bal-platform-toggle"
        @click="isPickerOpen = true"
    >
      {{ selectedPlatform }}
      <Icon name="heroicons:chevron-down" size="12"/>
    </button>
    <p v-else class="wh-bal-subtitle">Площадка: {{ selectedPlatform }}</p>

    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="items.length === 0">
      <p>На этой площадке нет остатков</p>
    </ErpEmptyState>

    <template v-else>
      <ErpSearchBar
          v-model="query"
          on-light
          placeholder="Поиск по наименованию"
          :count-label="`Найдено ${filteredItems.length} из ${items.length}`"
      />

      <ErpEmptyState v-if="filteredItems.length === 0">
        <p>Ничего не найдено по запросу «{{ query }}»</p>
        <UiButton variant="outline" @click="query = ''">Очистить поиск</UiButton>
      </ErpEmptyState>

      <template v-else>
        <div class="wh-bal-table">
          <div class="wh-bal-row wh-bal-row--head">
            <span>Кат.</span>
            <span>Наименование</span>
            <span class="wh-bal-row__num">Остаток</span>
            <span>Ед.</span>
          </div>
          <div v-for="item in filteredItems" :key="`${item.cell}-${item.name}-${item.type}`" class="wh-bal-row">
            <span class="wh-bal-cat">{{ item.category }}</span>
            <span>{{ item.name }}</span>
            <span class="wh-bal-row__num">{{ item.balance }}</span>
            <span>{{ item.unit }}</span>
          </div>
        </div>
      </template>
    </template>

    <ErpActionSheet
        :open="isPickerOpen"
        :busy="false"
        aria-label="Выбор площадки"
        @dismiss="isPickerOpen = false"
    >
      <template #label>Площадка</template>
      <template #form>
        <ErpGroupedList>
          <ErpListRow
              v-for="platform in platforms"
              :key="platform"
              :selected="platform === selectedPlatform"
              @click="selectPlatform(platform)"
          >
            {{ platform }}
          </ErpListRow>
        </ErpGroupedList>
      </template>
    </ErpActionSheet>
  </ErpScreen>
</template>

<style scoped lang="sass">
// Тот же язык карточки, что у ErpGroupedList (мягкая тень, без рамки) —
// раньше здесь была плоская рамка border+13px, выбивавшаяся из общего
// стиля карточек по всему приложению.
.wh-bal-table
  border-radius: 14px
  overflow: hidden
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.wh-bal-row
  display: grid
  grid-template-columns: 1.1fr 1.8fr 0.7fr 0.5fr
  gap: 6px
  padding: 9px 12px
  font-size: 12.5px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.15)
  align-items: center

  &:last-child
    border-bottom: none

  &--head
    background: var(--color-bg)
    font-weight: 700
    color: var(--color-text-secondary)
    font-size: 10.5px
    text-transform: uppercase
    letter-spacing: 0.3px

.wh-bal-row__num
  text-align: right
  font-variant-numeric: tabular-nums
  font-weight: 700

.wh-bal-cat
  font-size: 10.5px
  padding: 2px 7px
  border-radius: 6px
  background: var(--color-primary-light)
  color: var(--color-primary)
  display: inline-block
  width: fit-content

.wh-bal-platform-toggle
  display: inline-flex
  align-items: center
  gap: 5px
  align-self: flex-start
  padding: 6px 12px
  border: none
  border-radius: var(--radius-full)
  background: var(--color-primary-light)
  color: var(--color-primary)
  font-size: 12px
  font-weight: 700
  cursor: pointer

.wh-bal-subtitle
  margin: 0
  font-size: var(--font-size-sm)
  color: var(--color-text-secondary)
</style>
