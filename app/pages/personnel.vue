<script setup lang="ts">
import {createPersonnelEmployee, dismissPersonnelEmployee, fetchPersonnelDepartments, fetchPersonnelEmployee, fetchPersonnelEmployees, savePersonnelEmployee} from '~/utils/erp-sheets'
import type {ErpPersonnelDepartment, ErpPersonnelDraft, ErpPersonnelEmployee, ErpPersonnelRight, ErpPersonnelRow} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Кадры | ERP'})

const employeeStore = useErpEmployeeStore()
const departments = ref<ErpPersonnelDepartment[]>([])
const employees = ref<ErpPersonnelRow[]>([])
const platforms = ref<string[]>([])
const rights = ref<ErpPersonnelRight[]>([])
const selectedDepartment = ref('')
const isLoading = ref(true)
const error = ref('')
const isAddOpen = ref(false)
const selectedEmployeeRow = ref<ErpPersonnelRow | null>(null)
const selectedEmployee = ref<ErpPersonnelEmployee | null>(null)
const isBusy = ref(false)
const isDismissOpen = ref(false)
const {showError, showSuccess} = useAppToast()

const actor = computed(() => ({login: employeeStore.login, password: employeeStore.password}))

const loadDepartments = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const result = await fetchPersonnelDepartments(actor.value)
    departments.value = result.departments
    platforms.value = result.platforms
    rights.value = result.rights
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
}

const openEmployee = async (row: ErpPersonnelRow) => {
  isBusy.value = true
  try {
    selectedEmployee.value = await fetchPersonnelEmployee(actor.value, row.row, row.fio)
  } catch (loadError) {
    showError(loadError, 'Не удалось открыть карточку сотрудника')
  } finally {
    isBusy.value = false
  }
}

const refreshCurrent = async () => {
  await loadDepartments()
  if (selectedDepartment.value) await openDepartment(selectedDepartment.value)
}

const saveEmployee = async (draft: ErpPersonnelDraft) => {
  if (!selectedEmployee.value) return
  isBusy.value = true
  try {
    const saved = await savePersonnelEmployee(actor.value, selectedEmployee.value.row, selectedEmployee.value.fio, draft)
    if (saved.fio === employeeStore.fio && draft.password && draft.password !== employeeStore.password) {
      employeeStore.updatePassword(draft.password)
    }
    selectedEmployee.value = saved
    await refreshCurrent()
    showSuccess('Карточка сотрудника сохранена')
  } catch (saveError) {
    showError(saveError, 'Не удалось сохранить карточку')
  } finally {
    isBusy.value = false
  }
}

const createEmployee = async (draft: ErpPersonnelDraft) => {
  isBusy.value = true
  try {
    selectedEmployee.value = await createPersonnelEmployee(actor.value, draft)
    isAddOpen.value = false
    selectedDepartment.value = selectedEmployee.value.department
    await refreshCurrent()
    showSuccess('Сотрудник добавлен', `Пароль: ${selectedEmployee.value.password}`)
  } catch (createError) {
    showError(createError, 'Не удалось добавить сотрудника')
  } finally {
    isBusy.value = false
  }
}

const dismissEmployee = async () => {
  if (!selectedEmployee.value) return
  isBusy.value = true
  try {
    await dismissPersonnelEmployee(actor.value, selectedEmployee.value.row, selectedEmployee.value.fio)
    isDismissOpen.value = false
    selectedEmployee.value = null
    await refreshCurrent()
    showSuccess('Сотрудник уволен')
  } catch (dismissError) {
    showError(dismissError, 'Не удалось уволить сотрудника')
  } finally {
    isBusy.value = false
  }
}

onMounted(loadDepartments)
</script>

<template>
  <ErpScreen
      :title="selectedDepartment || 'Кадры'"
      icon="heroicons:user-group"
      :subtitle="selectedDepartment ? 'Сотрудники отдела' : 'Структура и доступы'"
      :shift-link="selectedDepartment ? {label: 'Все отделы', icon: 'heroicons:chevron-left', iconSize: 13, onClick: returnToDepartments} : undefined"
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
      <ErpPersonnelEmployeeTable v-if="employees.length" :employees="employees" @select="openEmployee"/>
      <ErpEmptyState v-else>
        <p>В отделе пока нет сотрудников</p>
      </ErpEmptyState>
      <UiButton variant="outline" @click="isAddOpen = true">Добавить сотрудника</UiButton>
    </template>

    <ErpActionSheet :open="isAddOpen" :busy="isBusy" aria-label="Добавление сотрудника" @dismiss="isAddOpen = false">
      <template #label>Новый сотрудник</template>
      <template #form>
        <ErpPersonnelForm create :platforms="platforms" :employee="{row: 0, fio: '', department: selectedDepartment, position: '', platform: '', role: 'Исполнитель', login: '', password: '', status: 'Работает', rights}" :busy="isBusy" @submit="createEmployee" @cancel="isAddOpen = false"/>
      </template>
    </ErpActionSheet>

    <ErpActionSheet :open="Boolean(selectedEmployee)" :busy="isBusy" aria-label="Карточка сотрудника" @dismiss="selectedEmployee = null">
      <template #label>Карточка сотрудника</template>
      <template #form>
        <ErpPersonnelForm :employee="selectedEmployee" :platforms="platforms" :busy="isBusy" @submit="saveEmployee" @cancel="selectedEmployee = null"/>
        <UiButton block variant="outline" class="personnel-dismiss" :disabled="isBusy" @click="isDismissOpen = true">Уволить</UiButton>
      </template>
    </ErpActionSheet>

    <ErpActionSheet :open="isDismissOpen" :busy="isBusy" aria-label="Подтверждение увольнения" @dismiss="isDismissOpen = false">
      <template #content>Уволить сотрудника? Вход в ERP для него будет отключён.</template>
      <template #actions>
        <UiButton block :loading="isBusy" @click="dismissEmployee">Уволить</UiButton>
        <UiButton block variant="outline" :disabled="isBusy" @click="isDismissOpen = false">Отмена</UiButton>
      </template>
    </ErpActionSheet>
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

.personnel-dismiss
  color: #d92d20
</style>
