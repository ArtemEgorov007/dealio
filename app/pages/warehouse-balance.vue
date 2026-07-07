<script setup lang="ts">
import {fetchWarehouseStock} from '~/utils/warehouse-sheets'
import type {WarehouseStockItem} from '~~/types/warehouse.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Баланс | ERP'})

const employeeStore = useErpEmployeeStore()

const items = ref<WarehouseStockItem[]>([])
const isLoading = ref(true)
const error = ref('')

const load = async () => {
    isLoading.value = true
    error.value = ''
    try {
        items.value = await fetchWarehouseStock(employeeStore.platform)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки остатков'
    } finally {
        isLoading.value = false
    }
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Баланс"
      icon="heroicons:scale"
      :subtitle="`Площадка: ${employeeStore.platform}`"
      :shift-link="{ to: '/warehouse', label: 'Склад', icon: 'heroicons:chevron-left', iconSize: 13 }"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="items.length === 0">
      <p>На вашей площадке нет остатков</p>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Остатки · {{ items.length }} {{ items.length === 1 ? 'позиция' : 'позиций' }}</ErpSectionLabel>
      <div class="wh-bal-table">
        <div class="wh-bal-row wh-bal-row--head">
          <span>Кат.</span>
          <span>Наименование</span>
          <span class="wh-bal-row__num">Остаток</span>
          <span>Ед.</span>
        </div>
        <div v-for="item in items" :key="`${item.cell}-${item.name}-${item.type}`" class="wh-bal-row">
          <span class="wh-bal-cat">{{ item.category }}</span>
          <span>{{ item.name }}</span>
          <span class="wh-bal-row__num">{{ item.balance }}</span>
          <span>{{ item.unit }}</span>
        </div>
      </div>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.wh-bal-table
  border-radius: 13px
  overflow: hidden
  border: 1px solid var(--color-border)
  background: var(--color-card-bg)

.wh-bal-row
  display: grid
  grid-template-columns: 1.1fr 1.8fr 0.7fr 0.5fr
  gap: 6px
  padding: 9px 12px
  font-size: 12.5px
  border-bottom: 1px solid var(--color-border)
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
</style>
