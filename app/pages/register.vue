<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {loginCrmEmployee} from '~/utils/crm-sheets'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'crm'})

const employeeStore = useCrmEmployeeStore()

const pageTitle = ref(employeeStore.hasFio ? 'Профиль | CRM' : 'Вход | CRM')
watch(() => employeeStore.hasFio, (hasFio) => {
    pageTitle.value = hasFio ? 'Профиль | CRM' : 'Вход | CRM'
})
useSeoMeta({title: pageTitle})
const router = useRouter()
const {showSuccess} = useAppToast()

const loginField = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const submit = async () => {
    if (!loginField.value.trim() || !password.value) {
        error.value = 'Введите логин и пароль'
        return
    }

    isLoading.value = true
    error.value = ''

    try {
        const profile = await loginCrmEmployee(loginField.value.trim(), password.value)
        employeeStore.setProfile(profile)
        password.value = ''
    } catch (loginError) {
        error.value = loginError instanceof Error ? loginError.message : 'Не удалось войти'
    } finally {
        isLoading.value = false
    }
}

const logout = () => {
    employeeStore.logout()
    loginField.value = ''
    password.value = ''
}

const copyText = async (text: string, label: string) => {
    try {
        await navigator.clipboard.writeText(text)
        showSuccess(`${label} скопирован`)
    } catch {
        // clipboard недоступен (HTTP или права) — молча пропускаем
    }
}

const goToBadges = () => router.push('/workshop')
const goToPacking = () => router.push('/workshop?flow=packing')
</script>

<template>
  <CrmScreen
      v-if="employeeStore.hasFio"
      title="Профиль"
      icon="heroicons:user-circle"
      :subtitle="employeeStore.fio"
  >
    <template #actions>
      <button type="button" class="logout-btn" aria-label="Выйти" @click="logout">
        <Icon name="heroicons:arrow-right-on-rectangle" size="22"/>
      </button>
    </template>

    <div class="profile-card">
      <div v-if="employeeStore.department" class="profile-row">
        <span class="profile-row__label">Отдел</span>
        <span class="profile-row__value">{{ employeeStore.department }}</span>
      </div>
      <div v-if="employeeStore.position" class="profile-row">
        <span class="profile-row__label">Должность</span>
        <span class="profile-row__value">{{ employeeStore.position }}</span>
      </div>
      <div v-if="employeeStore.platform" class="profile-row">
        <span class="profile-row__label">Площадка</span>
        <span class="profile-row__value">{{ employeeStore.platform }}</span>
      </div>
      <div v-if="employeeStore.login" class="profile-row profile-row--copy" @click="copyText(employeeStore.login, 'Логин')">
        <span class="profile-row__label">Логин</span>
        <span class="profile-row__value">{{ employeeStore.login }}</span>
        <Icon name="heroicons:clipboard-document" size="16" class="profile-row__copy-icon"/>
      </div>
      <div v-if="employeeStore.password" class="profile-row profile-row--copy" @click="copyText(employeeStore.password, 'Пароль')">
        <span class="profile-row__label">Пароль</span>
        <span class="profile-row__value profile-row__value--password">{{ employeeStore.password }}</span>
        <Icon name="heroicons:clipboard-document" size="16" class="profile-row__copy-icon"/>
      </div>
    </div>
  </CrmScreen>

  <CrmScreen
      v-else
      title="Вход"
      icon="heroicons:user-circle"
      subtitle="Войдите со своим логином"
  >
    <form class="register-form" @submit.prevent="submit">
      <UiInput
          id="crm-login"
          v-model="loginField"
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
.logout-btn
  display: flex
  align-items: center
  justify-content: center
  width: 34px
  height: 34px
  border: none
  border-radius: var(--radius-full)
  background: rgba(118, 118, 128, 0.12)
  color: var(--color-text-secondary)
  cursor: pointer
  transition: opacity 0.15s ease

  &:hover
    opacity: 0.7

.profile-card
  display: flex
  flex-direction: column
  border-radius: 13px
  overflow: hidden
  background-color: var(--color-card-bg)
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04)

.profile-row
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: 12px 16px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.15)

  &:last-child
    border-bottom: none

  &--copy
    cursor: pointer
    user-select: none
    transition: background-color 0.15s ease

    &:active
      background-color: rgba(60, 60, 67, 0.06)

.profile-row__label
  flex-shrink: 0
  width: 80px
  font-size: 13px
  font-weight: 400
  color: var(--color-text-secondary)

.profile-row__value
  flex: 1
  min-width: 0
  font-size: 15px
  font-weight: 400
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  color: var(--color-text)

  &--password
    font-family: monospace
    font-size: 14px

.profile-row__copy-icon
  flex-shrink: 0
  color: rgba(60, 60, 67, 0.30)

.register-form
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  margin-bottom: var(--spacing-3)

.register-actions
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
</style>
