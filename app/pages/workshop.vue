<script setup lang="ts">
import {CRM_WORKSHOPS} from '~~/types/crm.types'
import type {WorkshopId} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Выбор цеха | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()
const route = useRoute()

const isPacking = computed(() => route.query.flow === 'packing')

const selectWorkshop = (workshopId: WorkshopId) => {
    employeeStore.setWorkshop(workshopId)
    router.push(isPacking.value ? '/scan-qr' : '/badges')
}
</script>

<template>
  <CrmScreen
      title="Выбор цеха"
      :subtitle="isPacking ? 'Упаковка — выберите цех' : (employeeStore.hasFio ? `Сотрудник: ${employeeStore.fio}` : undefined)"
  >
    <div class="workshop-list">
      <button
          v-for="workshop in CRM_WORKSHOPS"
          :key="workshop.id"
          type="button"
          class="workshop-card"
          :class="{ 'workshop-card--active': employeeStore.workshopId === workshop.id }"
          @click="selectWorkshop(workshop.id)"
      >
        <span class="workshop-card__label">{{ workshop.label }}</span>
        <Icon name="heroicons:chevron-right" size="18" class="workshop-card__icon"/>
      </button>
    </div>
  </CrmScreen>
</template>

<style scoped lang="sass">
.workshop-list
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.workshop-card
  display: flex
  align-items: center
  justify-content: space-between
  width: 100%
  padding: 16px 18px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  background-color: var(--color-card-bg)
  color: var(--color-text)
  cursor: pointer
  transition: border-color var(--transition-normal) ease, background-color var(--transition-normal) ease

  &:hover
    border-color: var(--color-border-hover)
    background-color: var(--color-bg-tertiary)

  &--active
    border-color: var(--color-primary)
    background-color: var(--color-primary-light)

.workshop-card__label
  font-size: var(--font-size-lg)
  font-weight: 600

.workshop-card__icon
  color: var(--color-text-muted)
</style>
