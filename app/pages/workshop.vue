<script setup lang="ts">
import {CRM_WORKSHOPS} from '~~/types/crm.types'
import type {WorkshopId} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useCrmSessionStore} from '~~/store/crm-session.store'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Выбор цеха | ERP'})

const employeeStore = useCrmEmployeeStore()
const sessionStore = useCrmSessionStore()
const router = useRouter()
const route = useRoute()

const isPacking = computed(() => route.query.flow === 'packing')

const selectWorkshop = (workshopId: WorkshopId) => {
    employeeStore.setWorkshop(workshopId)
    sessionStore.setPackingWorkshopConfirmed(isPacking.value)
    router.push(isPacking.value ? '/scan-qr' : '/badges')
}
</script>

<template>
  <CrmScreen
      title="Выбор цеха"
      :subtitle="isPacking ? 'Упаковка — выберите цех' : (employeeStore.hasFio ? `Сотрудник: ${employeeStore.fio}` : undefined)"
      :shift-link="isPacking ? undefined : { to: '/shift', label: 'Бирки за смену' }"
      :icon="isPacking ? 'heroicons:qr-code' : 'heroicons:tag'"
  >
    <CrmSectionLabel>Доступные цеха</CrmSectionLabel>

    <CrmGroupedList>
      <CrmListRow
          v-for="workshop in CRM_WORKSHOPS"
          :key="workshop.id"
          :selected="employeeStore.workshopId === workshop.id"
          @click="selectWorkshop(workshop.id)"
      >
        {{ workshop.label }}
      </CrmListRow>
    </CrmGroupedList>
  </CrmScreen>
</template>
