<script setup lang="ts">
defineProps<{
  department?: string
  activeCount?: number
  add?: boolean
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="personnel-tile" :class="{'personnel-tile--add': add}" @click="$emit('click')">
    <span class="personnel-tile__icon">
      <Icon :name="add ? 'heroicons:plus' : 'heroicons:building-office-2'" size="24"/>
    </span>
    <span class="personnel-tile__title">{{ add ? 'Добавить сотрудника' : department }}</span>
    <span class="personnel-tile__meta">{{ add ? 'Новая карточка' : `${activeCount ?? 0} сотрудников работают` }}</span>
  </button>
</template>

<style scoped lang="sass">
.personnel-tile
  min-height: 142px
  padding: 16px
  display: flex
  flex-direction: column
  align-items: flex-start
  gap: 8px
  border: none
  border-radius: 16px
  background: var(--color-card-bg)
  color: var(--color-text)
  text-align: left
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, .04))
  cursor: pointer

  &:active
    transform: scale(.98)

  &--add
    border: 1.5px dashed rgba(1, 110, 215, .38)
    background: var(--color-primary-light)
    color: var(--color-primary)

.personnel-tile__icon
  width: 42px
  height: 42px
  display: inline-flex
  align-items: center
  justify-content: center
  border-radius: 12px
  background: rgba(1, 110, 215, .12)
  color: var(--color-primary)

.personnel-tile--add .personnel-tile__icon
  background: #fff

.personnel-tile__title
  font-size: 15px
  font-weight: 750
  line-height: 1.25

.personnel-tile__meta
  margin-top: auto
  font-size: 12px
  line-height: 1.3
  color: var(--color-text-secondary)

.personnel-tile--add .personnel-tile__meta
  color: var(--color-primary)
</style>
