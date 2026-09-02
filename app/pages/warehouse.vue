<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Склад | ERP'})

const employeeStore = useErpEmployeeStore()

// Плитки те же, что на главном экране и в «Работе со снабжением»: раздел
// должен читаться как часть приложения, а не как отдельный экран со своей
// вёрсткой. Раньше здесь лежали три растянутых во всю ширину строки —
// собственный размер, собственные отступы, собственные иконки.
const actions = [
    {
        to: '/warehouse-receive',
        icon: 'heroicons:arrow-down-tray',
        label: 'Приём',
        caption: 'Оприходовать товар',
        tone: '#1E8A4C',
    },
    {
        to: '/warehouse-issue',
        icon: 'heroicons:arrow-up-tray',
        label: 'Выдача',
        caption: 'Выдать со склада',
        tone: '#C97A0C',
    },
    {
        to: '/warehouse-balance',
        icon: 'heroicons:scale',
        label: 'Баланс',
        caption: 'Остатки площадки',
        tone: '#7C5CE0',
    },
]
</script>

<template>
  <ErpScreen
      title="Склад"
      icon="heroicons:archive-box"
      :subtitle="`Площадка: ${employeeStore.platform}`"
      :shift-link="{ to: '/register', label: employeeStore.fio, icon: 'heroicons:user-circle' }"
  >
    <ErpSectionLabel>Действия</ErpSectionLabel>
    <div class="wh-grid">
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
.wh-grid
  display: grid
  grid-template-columns: 1fr 1fr
  gap: var(--spacing-3)
</style>
