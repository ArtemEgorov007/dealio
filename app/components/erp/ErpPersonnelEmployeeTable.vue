<script setup lang="ts">
import type {ErpPersonnelRow} from '~~/types/erp.types'

defineProps<{ employees: ErpPersonnelRow[] }>()
defineEmits<{ select: [employee: ErpPersonnelRow] }>()
</script>

<template>
  <ErpGroupedList aria-label="Сотрудники отдела">
    <ErpListRow
        v-for="employee in employees"
        :key="employee.row"
        chevron
        class="personnel-list-row"
        :aria-label="`Открыть карточку: ${employee.fio}`"
        @click="$emit('select', employee)"
    >
      <template #leading>
        <span class="personnel-row-ic">
          <Icon name="heroicons:user" size="16"/>
        </span>
      </template>
      <span class="personnel-row">
        <span class="personnel-row__title">{{ employee.fio }}</span>
        <span v-if="employee.position" class="personnel-row__sub">{{ employee.position }}</span>
      </span>
    </ErpListRow>
  </ErpGroupedList>
</template>

<style scoped lang="sass">
/* Тот же язык строк, что у списка бирок */
.personnel-list-row
  align-items: center
  padding-top: 10px
  padding-bottom: 10px

.personnel-row-ic
  display: flex
  align-items: center
  justify-content: center
  width: 30px
  height: 30px
  border-radius: 9px
  background: rgba(1, 110, 215, 0.10)
  color: var(--color-primary)

.personnel-row
  display: flex
  flex-direction: column
  gap: 1px
  min-width: 0

.personnel-row__title
  font-size: 15px
  font-weight: 650
  line-height: 1.3
  color: var(--color-text)

.personnel-row__sub
  font-size: 12px
  line-height: 1.35
  color: var(--color-text-secondary)
</style>
