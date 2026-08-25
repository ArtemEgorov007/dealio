<script setup lang="ts">
import {fetchPersonnelDepartments, fetchPersonnelEmployees} from '~/utils/erp-sheets'
import type {ErpPersonnelDepartment, ErpPersonnelRow} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Кадры | ERP'})

const employeeStore = useErpEmployeeStore()
const departments = ref<ErpPersonnelDepartment[]>([])
const employees = ref<ErpPersonnelRow[]>([])
const selectedDepartment = ref('')
const isLoading = ref(true)
const error = ref('')
const isAddOpen = ref(false)
const selectedEmployeeRow = ref<ErpPersonnelRow | null>(null)

const actor = computed(() => ({login: employeeStore.login, password: employeeStore.password}))

const loadDepartments = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const result = await fetchPersonnelDepartments(actor.value)
    departments.value = result.departments
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Не удалось загрузить отделы'
  } finally {
    isLoading.value = false
  }
}

const openDepartment = async (department: string) => {
  isLoading.value = true
  error.value = ''
  try {
    employees.value = await fetchPersonnelEmployees(actor.value, department)
    selectedDepartment.value = department
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Не удалось загрузить сотрудников'
  } finally {
    isLoading.value = false
  }
}

const returnToDepartments = () => {
  selectedDepartment.value = ''
  employees.value = []
  selectedEmployeeRow.value = null
  loadDepartments()
}

onMounted(loadDepartments)
</script>

<template>
  <ErpScreen
      :title="selectedDepartment || 'Кадры'"
      icon="heroicons:user-group"
      :subtitle="selectedDepartment ? 'Сотрудники отдела' : 'Структура и доступы'"
      :shift-link="selectedDepartment ? {to: '/personnel', label: 'Все отделы', icon: 'heroicons:chevron-left', iconSize: 13} : undefined"
  >
    <ErpEmptyState v-if="isLoading" loading>Загрузка…</ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="selectedDepartment ? openDepartment(selectedDepartment) : loadDepartments">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else-if="!selectedDepartment">
      <div class="personnel-grid">
        <ErpPersonnelDepartmentTile
            v-for="department in departments"
            :key="department.department"
            :department="department.department"
            :active-count="department.activeCount"
            @click="openDepartment(department.department)"
        />
        <ErpPersonnelDepartmentTile add @click="isAddOpen = true"/>
      </div>
      <p v-if="departments.length === 0" class="personnel-empty-copy">Нет отделов с работающими сотрудниками</p>
    </template>

    <template v-else>
      <ErpPersonnelEmployeeTable v-if="employees.length" :employees="employees" @select="selectedEmployeeRow = $event"/>
      <ErpEmptyState v-else>
        <p>В отделе пока нет сотрудников</p>
      </ErpEmptyState>
      <UiButton variant="outline" @click="isAddOpen = true">Добавить сотрудника</UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.personnel-grid
  display: grid
  grid-template-columns: repeat(2, minmax(0, 1fr))
  gap: 12px

.personnel-empty-copy
  margin: 0
  color: var(--color-text-secondary)
  font-size: var(--font-size-sm)
  text-align: center
</style>
