<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Регистрация | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()

const fio = ref(employeeStore.fio)
const error = ref('')

const submit = () => {
    const value = fio.value.trim()

    if (value.length < 3) {
        error.value = 'Введите ФИО полностью (минимум 3 символа)'
        return
    }

    employeeStore.setFio(value)
    router.push('/workshop')
}
</script>

<template>
  <CrmScreen
      title="Регистрация"
      subtitle="Укажите ФИО — оно будет подставляться в журнал выдачи бирок"
  >
    <UiInput
        id="crm-fio"
        v-model="fio"
        label="ФИО"
        placeholder="Иванов Иван Иванович"
        autocomplete="name"
        required
        :error="error"
        @keyup.enter="submit"
    />

    <UiButton block @click="submit">
      Продолжить
    </UiButton>
  </CrmScreen>
</template>
