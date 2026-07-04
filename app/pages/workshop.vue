<script setup lang="ts">
import {ERP_WORKSHOPS} from '~~/types/erp.types'
import type {WorkshopId} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Выбор цеха | ERP'})

const employeeStore = useErpEmployeeStore()
const sessionStore = useErpSessionStore()
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
  <ErpScreen
      title="Выбор цеха"
      :subtitle="isPacking ? 'Упаковка — выберите цех' : (employeeStore.hasFio ? `Сотрудник: ${employeeStore.fio}` : undefined)"
      :shift-link="isPacking ? undefined : { to: '/shift', label: 'Бирки за смену' }"
      :icon="isPacking ? 'heroicons:qr-code' : 'heroicons:tag'"
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
