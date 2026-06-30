<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {loginCrmEmployee} from '~/utils/crm-sheets'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Вход | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()

const login = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const submit = async () => {
    if (!login.value.trim() || !password.value) {
        error.value = 'Введите логин и пароль'
        return
    }

    isLoading.value = true
    error.value = ''

    try {
        const profile = await loginCrmEmployee(login.value.trim(), password.value)
        employeeStore.setFio(profile.fio)
        password.value = ''
    } catch (loginError) {
        error.value = loginError instanceof Error ? loginError.message : 'Не удалось войти'
    } finally {
        isLoading.value = false
    }
}

const proceed = (path: string) => router.push(path)
const goToBadges = () => proceed('/workshop')
const goToPacking = () => proceed('/workshop?flow=packing')

const logout = () => {
    employeeStore.logout()
    login.value = ''
    password.value = ''
}
</script>

<template>
  <CrmScreen
      v-if="employeeStore.hasFio"
      title="Профиль"
      :subtitle="`Сотрудник: ${employeeStore.fio}`"
  >
    <div class="register-actions">
      <UiButton block @click="goToBadges">
        Бирки
      </UiButton>
      <UiButton block variant="outline" @click="goToPacking">
        Упаковки
      </UiButton>
      <UiButton block variant="ghost" @click="logout">
        Выйти
      </UiButton>
    </div>
  </CrmScreen>

  <CrmScreen
      v-else
      title="Вход"
      subtitle="Войдите со своим логином — он используется для журнала выдачи бирок"
  >
    <form class="register-form" @submit.prevent="submit">
      <UiInput
          id="crm-login"
          v-model="login"
          label="Логин"
          autocomplete="username"
          required
          @keyup.enter="submit"
      />
      <UiInput
          id="crm-password"
          v-model="password"
          type="password"
          label="Пароль"
          autocomplete="current-password"
          required
          :error="error"
          @keyup.enter="submit"
      />
    </form>

    <div class="register-actions">
      <UiButton block :loading="isLoading" @click="submit">
        Войти
      </UiButton>
    </div>
  </CrmScreen>
</template>

<style scoped lang="sass">
.register-form
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-4)

.register-actions
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
</style>
