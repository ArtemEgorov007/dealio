<script setup lang="ts">
import type {ErpPersonnelRow} from '~~/types/erp.types'

defineProps<{ employees: ErpPersonnelRow[] }>()
defineEmits<{ select: [employee: ErpPersonnelRow] }>()
</script>

<template>
  <div class="personnel-table" role="table" aria-label="Сотрудники отдела">
    <div class="personnel-table__row personnel-table__row--head" role="row">
      <span role="columnheader">Должность</span>
      <span role="columnheader">ФИО</span>
    </div>
    <button
        v-for="employee in employees"
        :key="employee.row"
        type="button"
        class="personnel-table__row personnel-table__row--button"
        role="row"
        :aria-label="`Открыть карточку: ${employee.fio}`"
        @click="$emit('select', employee)"
    >
      <span role="cell">{{ employee.position }}</span>
      <span role="cell" class="personnel-table__fio">{{ employee.fio }}</span>
      <span class="personnel-table__open" aria-hidden="true">
        <span>Открыть</span>
        <Icon name="heroicons:chevron-right" size="16"/>
      </span>
    </button>
  </div>
</template>

<style scoped lang="sass">
.personnel-table
  overflow: hidden
  border-radius: 14px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, .04))

.personnel-table__row
  width: 100%
  display: grid
  grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr) auto
  gap: 12px
  align-items: center
  padding: 12px 14px
  box-sizing: border-box
  border: none
  border-bottom: .5px solid rgba(60, 60, 67, .15)
  background: transparent
  color: var(--color-text)
  text-align: left
  font-size: 13px
  line-height: 1.35

  &:last-child
    border-bottom: none

  &--head
    background: var(--color-bg)
    color: var(--color-text-secondary)
    font-size: 10.5px
    font-weight: 700
    letter-spacing: .3px
    text-transform: uppercase

  &--button
    cursor: pointer
    transition: background-color .15s ease, transform .15s ease

    &:hover
      background: rgba(1, 110, 215, .055)

    &:focus-visible
      position: relative
      z-index: 1
      outline: 2px solid var(--color-primary)
      outline-offset: -2px

    &:active
      background: rgba(60, 60, 67, .08)
      transform: scale(.99)

.personnel-table__fio
  font-weight: 650

.personnel-table__open
  display: inline-flex
  align-items: center
  justify-content: flex-end
  gap: 2px
  color: var(--color-primary)
  font-size: 11px
  font-weight: 650
  white-space: nowrap
</style>
