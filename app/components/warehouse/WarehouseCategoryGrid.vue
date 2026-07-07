<script setup lang="ts">
defineProps<{
  categories: string[]
  selected: string | null
}>()

defineEmits<{
  select: [category: string]
}>()

// Категории приходят из листа «Номенклатура» (не фиксированный enum) — маппинг
// покрывает известные на сегодня значения, для незнакомой категории иконка
// падает на общий heroicons:tag, а не ломается.
const CATEGORY_ICONS: Record<string, string> = {
  'Канцелярия': 'heroicons:pencil-square',
  'СИЗ': 'heroicons:shield-check',
  'Инструменты': 'heroicons:wrench-screwdriver',
  'Форма': 'heroicons:user',
  'Малое оборудование': 'heroicons:cog-6-tooth',
  'Окрасочные расходники': 'heroicons:paint-brush',
  'Запчасти': 'heroicons:cube',
  'Электрика': 'heroicons:bolt',
  'Прочие расходники': 'heroicons:archive-box',
  'Крепежи': 'heroicons:link',
}

const iconFor = (category: string) => CATEGORY_ICONS[category] || 'heroicons:tag'
</script>

<template>
  <div class="wh-cat-grid">
    <button
        v-for="category in categories"
        :key="category"
        type="button"
        class="wh-cat-tile"
        :class="{ 'wh-cat-tile--active': category === selected }"
        @click="$emit('select', category)"
    >
      <span class="wh-cat-tile__ic"><Icon :name="iconFor(category)" size="20"/></span>
      <b>{{ category }}</b>
    </button>
  </div>
</template>

<style scoped lang="sass">
.wh-cat-grid
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 8px

/* Размеры — как у ErpTile («Разделы» на /register), а не мельче: один
   плиточный паттерн на всё приложение, не отдельный урезанный вариант */
.wh-cat-tile
  display: flex
  flex-direction: column
  gap: 9px
  min-height: 107px
  padding: 13px 12px 12px
  border: 1px solid var(--color-border)
  border-radius: 16px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-tile, var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04)))
  text-align: left
  cursor: pointer

  &--active
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.wh-cat-tile__ic
  display: flex
  align-items: center
  justify-content: center
  width: 36px
  height: 36px
  border-radius: 11px
  background: var(--color-primary-light)
  color: var(--color-primary)

.wh-cat-tile b
  font-size: 14px
  font-weight: 700
  letter-spacing: -0.2px
  line-height: 1.25
</style>
