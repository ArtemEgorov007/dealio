<script setup lang="ts">
definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Отчёты | ERP'})

// Плитки те же, что на главном экране: раздел должен читаться как его
// часть, а не как отдельное приложение — тот же приём, что у «Заявки и
// счета» (app/pages/supply-work.vue).
const tiles = [
  {
    to: '/reports-month',
    icon: 'heroicons:chart-bar',
    label: 'Месячный отчёт',
    caption: 'Оперативный срез производства',
    tone: '#016ED7',
  },
  {
    to: '/reports-full',
    icon: 'heroicons:document-chart-bar',
    label: 'Полный отчёт',
    caption: 'ТП, поступление, отгрузка',
    tone: '#0F766E',
  },
  {
    to: '/reports-ks',
    icon: 'heroicons:document-currency-dollar',
    label: 'КС',
    caption: 'Суммы и статусы по договорам',
    tone: '#B45309',
  },
  {
    to: '/reports-id',
    icon: 'heroicons:clipboard-document-check',
    label: 'ИД',
    caption: 'Исполнительная документация',
    tone: '#7C3AED',
  },
]
</script>

<template>
  <ErpScreen
      title="Отчёты"
      subtitle="Разделы отчётности"
      icon="heroicons:chart-bar"
  >
    <ErpSectionLabel>Разделы</ErpSectionLabel>
    <div class="reports-grid">
      <ErpTile
          v-for="tile in tiles"
          :key="tile.to"
          :to="tile.to"
          :icon="tile.icon"
          :label="tile.label"
          :caption="tile.caption"
          :tone="tile.tone"
      />
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.reports-grid
  display: grid
  grid-template-columns: 1fr 1fr
  gap: var(--spacing-3)
</style>
