<script setup lang="ts">
import {useErpSupplyQueueStore} from '~~/store/erp-supply-queue.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Заявки и счета | ERP'})

const supplyQueueStore = useErpSupplyQueueStore()

// Плитки те же, что на главном экране: раздел должен читаться как его часть,
// а не как отдельное приложение. Пункты добавятся — сетка выдержит.
const actions = computed(() => [
    {
        to: '/supply-requests-queue',
        icon: 'heroicons:clipboard-document-list',
        label: 'Заявки',
        caption: 'Статус по заявкам снабжения',
        tone: '#B45309',
        count: supplyQueueStore.newCount > 0 ? supplyQueueStore.newCount : null,
    },
    {
        to: '/invoice-new',
        icon: 'heroicons:document-plus',
        label: 'Завести счёт',
        caption: 'По заявке снабжения',
        tone: '#0F766E',
        count: null,
    },
    {
        to: '/supply-catalog',
        icon: 'heroicons:book-open',
        label: 'Справочник',
        caption: 'Номенклатура склада',
        tone: '#4F46E5',
        count: null,
    },
])
</script>

<template>
  <ErpScreen
      title="Заявки и счета"
      subtitle="Заявки, счета и справочники"
      icon="heroicons:briefcase"
      :shift-link="{to: '/invoices', label: 'Все счета', icon: 'heroicons:document-text', iconSize: 13}"
  >
    <ErpSectionLabel>Действия</ErpSectionLabel>
    <div class="work-grid">
      <ErpTile
          v-for="action in actions"
          :key="action.to"
          :to="action.to"
          :icon="action.icon"
          :label="action.label"
          :caption="action.caption"
          :tone="action.tone"
          :count="action.count"
      />
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.work-grid
  display: grid
  grid-template-columns: 1fr 1fr
  gap: var(--spacing-3)
</style>
