<script setup lang="ts">
definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Работа со снабжением | ERP'})

// Плитки те же, что на главном экране: раздел должен читаться как его часть,
// а не как отдельное приложение. Пункты добавятся — сетка выдержит.
const actions = [
    {
        to: '/invoice-new',
        icon: 'heroicons:document-plus',
        label: 'Завести счёт',
        caption: 'По заявке снабжения',
        tone: '#0F766E',
    },
    {
        to: '/supply-catalog',
        icon: 'heroicons:book-open',
        label: 'Справочник',
        caption: 'Номенклатура склада',
        tone: '#4F46E5',
    },
]
</script>

<template>
  <ErpScreen
      title="Работа со снабжением"
      subtitle="Счета и справочники"
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
