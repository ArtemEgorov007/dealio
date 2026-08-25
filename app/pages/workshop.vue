<script setup lang="ts">
import {ERP_WORKSHOPS} from '~~/types/erp.types'
import type {WorkshopId} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {fetchIssuedBadgesToday} from '~/utils/erp-sheets'
import {getShiftCounterScope} from '~/utils/shift-counter-scope'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Выбор цеха | ERP'})

const employeeStore = useErpEmployeeStore()
const router = useRouter()

const selectWorkshop = (workshopId: WorkshopId) => {
    employeeStore.setWorkshop(workshopId)
    router.push('/badges')
}

// Живой счётчик выданных за смену бирок — перенесён сюда из Профиля по правке руководства
const issuedCount = ref<number | null>(null)

onMounted(async () => {
    if (!employeeStore.hasFio || !employeeStore.access.badges) return
    try {
        const scope = getShiftCounterScope(employeeStore.role, employeeStore.fio)
        issuedCount.value = (await fetchIssuedBadgesToday(scope.fio ?? '', null)).length
    } catch {
        issuedCount.value = null
    }
})
</script>

<template>
  <ErpScreen
      title="Выбор цеха"
      :subtitle="employeeStore.hasFio ? `Сотрудник: ${employeeStore.fio}` : undefined"
      :shift-link="{ to: '/shift', label: 'Бирки за смену' }"
      icon="heroicons:tag"
  >
    <template v-if="issuedCount != null" #hero>
      <div class="erp-screen__stats">
        <div class="erp-screen__stat">
          <span class="erp-screen__stat-num">{{ issuedCount }}</span>
          <span class="erp-screen__stat-label">бирок за смену</span>
        </div>
      </div>
    </template>

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
