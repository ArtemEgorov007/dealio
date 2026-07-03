<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {loginCrmEmployee} from '~/utils/crm-sheets'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'crm'})

const employeeStore = useCrmEmployeeStore()

const pageTitle = ref(employeeStore.hasFio ? 'Профиль | ERP' : 'Вход | ERP')
watch(() => employeeStore.hasFio, (hasFio) => {
    pageTitle.value = hasFio ? 'Профиль | ERP' : 'Вход | ERP'
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

    <CrmGroupedList>
      <CrmListRow
          v-if="employeeStore.department"
          tag="div"
      >
        <span class="profile-kv">
          <span class="profile-kv__label">Отдел</span>
          <span class="profile-kv__value">{{ employeeStore.department }}</span>
        </span>
      </CrmListRow>
      <CrmListRow
          v-if="employeeStore.position"
          tag="div"
      >
        <span class="profile-kv">
          <span class="profile-kv__label">Должность</span>
          <span class="profile-kv__value">{{ employeeStore.position }}</span>
        </span>
      </CrmListRow>
      <CrmListRow
          v-if="employeeStore.platform"
          tag="div"
      >
        <span class="profile-kv">
          <span class="profile-kv__label">Площадка</span>
          <span class="profile-kv__value">{{ employeeStore.platform }}</span>
        </span>
      </CrmListRow>
      <CrmListRow
          v-if="employeeStore.login"
          @click="copyText(employeeStore.login, 'Логин')"
      >
        <span class="profile-kv">
          <span class="profile-kv__label">Логин</span>
          <span class="profile-kv__value">{{ employeeStore.login }}</span>
        </span>
        <template #trailing>
          <Icon name="heroicons:clipboard-document" size="16" class="profile-kv__icon"/>
        </template>
      </CrmListRow>
      <CrmListRow
          v-if="employeeStore.password"
          @click="copyText(employeeStore.password, 'Пароль')"
      >
        <span class="profile-kv">
          <span class="profile-kv__label">Пароль</span>
          <span class="profile-kv__value profile-kv__value--mono">{{ employeeStore.password }}</span>
        </span>
        <template #trailing>
          <Icon name="heroicons:clipboard-document" size="16" class="profile-kv__icon"/>
        </template>
      </CrmListRow>
    </CrmGroupedList>
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

.profile-kv
  display: flex
  align-items: center
  gap: 12px
  width: 100%
  min-width: 0

.profile-kv__label
  flex-shrink: 0
  width: 88px
  font-size: 15px
  color: var(--color-text)

.profile-kv__value
  flex: 1
  min-width: 0
  font-size: 15px
  text-align: right
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  color: var(--color-text-secondary)

  &--mono
    font-family: monospace
    font-size: 14px

.profile-kv__icon
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
