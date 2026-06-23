<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Регистрация | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()

const fio = ref(employeeStore.fio)
const error = ref('')

// Сохраняем в стор по мере набора — иначе переход через нижний tab bar
// (а не через кнопки на этом экране) терял введённое, но не отправленное
// ФИО, и middleware возвращал назад на /register.
watch(fio, (value) => {
    const trimmed = value.trim()
    if (trimmed.length >= 3) {
        employeeStore.setFio(trimmed)
    }
})

const proceed = (path: string) => {
    const value = fio.value.trim()

    if (value.length < 3) {
        error.value = 'Введите ФИО полностью (минимум 3 символа)'
        return
    }

    employeeStore.setFio(value)
    router.push(path)
}

const goToBadges = () => proceed('/workshop')
const goToPacking = () => proceed('/workshop?flow=packing')
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
        @keyup.enter="goToBadges"
    />

    <div class="register-actions">
      <UiButton block @click="goToBadges">
        Бирки
      </UiButton>
      <UiButton block variant="outline" @click="goToPacking">
        Упаковки
      </UiButton>
    </div>
  </CrmScreen>
</template>

<style scoped lang="sass">
.register-actions
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
</style>
