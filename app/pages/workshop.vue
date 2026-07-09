<script setup lang="ts">
import {ERP_WORKSHOPS} from '~~/types/erp.types'
import type {WorkshopId} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Выбор цеха | ERP'})

const employeeStore = useErpEmployeeStore()
const router = useRouter()

const selectWorkshop = (workshopId: WorkshopId) => {
    employeeStore.setWorkshop(workshopId)
    router.push('/badges')
}
</script>

<template>
  <ErpScreen
      title="Выбор цеха"
      :subtitle="employeeStore.hasFio ? `Сотрудник: ${employeeStore.fio}` : undefined"
      :shift-link="{ to: '/shift', label: 'Бирки за смену' }"
      icon="heroicons:tag"
  >
    <ErpSectionLabel>Доступные цеха</ErpSectionLabel>

    <ErpGroupedList>
      <ErpListRow
          v-for="workshop in ERP_WORKSHOPS"
          :key="workshop.id"
          :selected="employeeStore.workshopId === workshop.id"
          @click="selectWorkshop(workshop.id)"
      >
        {{ workshop.label }}
      </ErpListRow>
    </ErpGroupedList>
  </ErpScreen>
</template>
