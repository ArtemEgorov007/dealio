<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {loginCrmEmployee} from '~/utils/crm-sheets'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Вход | CRM'})

const employeeStore = useCrmEmployeeStore()
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
  width: 36px
  height: 36px
  border: none
  border-radius: var(--radius-md)
  background: none
  color: var(--color-text-muted)
  cursor: pointer
  transition: color var(--transition-normal) ease, background-color var(--transition-normal) ease

  &:hover
    color: var(--color-danger)
    background-color: rgba(239, 68, 68, 0.08)

.profile-card
  display: flex
  flex-direction: column
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  overflow: hidden
  background-color: var(--color-card-bg)

.profile-row
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: 14px 16px
  border-bottom: var(--border-width) solid var(--color-border)

  &:last-child
    border-bottom: none

  &--copy
    cursor: pointer
    user-select: none

    &:hover
      background-color: var(--color-primary-light)

      .profile-row__copy-icon
        color: var(--color-primary)

.profile-row__label
  flex-shrink: 0
  width: 90px
  font-size: var(--font-size-xs)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  color: var(--color-text-muted)

.profile-row__value
  flex: 1
  min-width: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

  &--password
    font-family: monospace

.profile-row__copy-icon
  flex-shrink: 0
  color: var(--color-text-muted)

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
