<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {loginErpEmployee, fetchIssuedBadgesToday, fetchHandedOverBadgesToday} from '~/utils/erp-sheets'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})

const employeeStore = useErpEmployeeStore()

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

// Имя из ФИО (Фамилия Имя Отчество) — для приветствия
const firstName = computed(() => employeeStore.fio.trim().split(/\s+/)[1] ?? '')
const greeting = computed(() => firstName.value ? `Здравствуйте, ${firstName.value}` : 'Здравствуйте')
const shiftLine = computed(() => {
    const parts = [employeeStore.position, employeeStore.platform].filter(Boolean)
    return parts.join(' · ') || undefined
})

// Модули хаба — те же, что в таб-баре, фильтр по доступам сотрудника
const modules = computed(() => {
    const a = employeeStore.access
    const all = [
        {key: 'badges', to: '/workshop', icon: 'heroicons:tag', label: 'Бирки', caption: 'Выдать', tone: '#016ED7'},
        {key: 'measurements', to: '/scan-measurement', icon: 'heroicons:beaker', label: 'Промеры', caption: 'Считать', tone: '#2FB463'},
        {key: 'packing', to: '/workshop?flow=packing', icon: 'heroicons:qr-code', label: 'Упаковка', caption: 'QR-скан', tone: '#E7920B'},
        {key: 'handover', to: '/scan-handover', icon: 'heroicons:check-badge', label: 'Сдача', caption: 'Приёмка', tone: '#8E4EC6'},
        {key: 'reports', to: '/reports', icon: 'heroicons:chart-bar', label: 'Отчёты', caption: 'В разработке', tone: '#016ED7'},
        {key: 'approvals', to: '/approvals', icon: 'heroicons:check-circle', label: 'Согласования', caption: 'В разработке', tone: '#016ED7'},
        {key: 'supply', to: '/supply', icon: 'heroicons:truck', label: 'Снабжение', caption: 'В разработке', tone: '#5B6B7F'},
        {key: 'orders', to: '/orders', icon: 'heroicons:shopping-bag', label: 'Заказы', caption: 'В разработке', tone: '#5B6B7F'},
        {key: 'warehouse', to: '/warehouse', icon: 'heroicons:archive-box', label: 'Склад', caption: 'В разработке', tone: '#5B6B7F'},
    ]
    return all.filter(m => a[m.key as keyof typeof a])
})

// Живые счётчики за смену для стат-чипов в шапке хаба
const issuedCount = ref<number | null>(null)
const handedCount = ref<number | null>(null)

const loadShiftStats = async () => {
    if (!employeeStore.hasFio) return
    const a = employeeStore.access
    if (a.badges) {
        try {
            issuedCount.value = (await fetchIssuedBadgesToday(employeeStore.fio, null)).length
        } catch {
            issuedCount.value = null
        }
    }
    if (a.handover) {
        try {
            handedCount.value = (await fetchHandedOverBadgesToday(employeeStore.fio)).length
        } catch {
            handedCount.value = null
        }
    }
}

onMounted(loadShiftStats)
watch(() => employeeStore.hasFio, (has) => { if (has) loadShiftStats() })

const submit = async () => {
    if (!loginField.value.trim() || !password.value) {
        error.value = 'Введите логин и пароль'
        return
    }

    isLoading.value = true
    error.value = ''

    try {
        const profile = await loginErpEmployee(loginField.value.trim(), password.value)
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
</script>

<template>
  <ErpScreen
      v-if="employeeStore.hasFio"
      :title="greeting"
      :subtitle="shiftLine"
  >
    <template #actions>
      <button type="button" class="logout-btn" aria-label="Выйти" @click="logout">
        <Icon name="heroicons:arrow-right-on-rectangle" size="20"/>
      </button>
    </template>

    <template v-if="issuedCount != null || handedCount != null" #hero>
      <div class="hub-stats">
        <div v-if="issuedCount != null" class="hub-stat">
          <span class="hub-stat__num">{{ issuedCount }}</span>
          <span class="hub-stat__label">бирок за смену</span>
        </div>
        <div v-if="handedCount != null" class="hub-stat">
          <span class="hub-stat__num">{{ handedCount }}</span>
          <span class="hub-stat__label">сдач за смену</span>
        </div>
      </div>
    </template>

    <ErpSectionLabel>Разделы</ErpSectionLabel>
    <div class="hub-grid">
      <ErpTile
          v-for="m in modules"
          :key="m.to"
          :to="m.to"
          :icon="m.icon"
          :label="m.label"
          :caption="m.caption"
          :tone="m.tone"
      />
    </div>

    <ErpSectionLabel>Профиль</ErpSectionLabel>
    <ErpGroupedList>
      <ErpListRow v-if="employeeStore.department" tag="div">
        <span class="profile-kv">
          <span class="profile-kv__label">Отдел</span>
          <span class="profile-kv__value">{{ employeeStore.department }}</span>
        </span>
      </ErpListRow>
      <ErpListRow v-if="employeeStore.position" tag="div">
        <span class="profile-kv">
          <span class="profile-kv__label">Должность</span>
          <span class="profile-kv__value">{{ employeeStore.position }}</span>
        </span>
      </ErpListRow>
      <ErpListRow v-if="employeeStore.platform" tag="div">
        <span class="profile-kv">
          <span class="profile-kv__label">Площадка</span>
          <span class="profile-kv__value">{{ employeeStore.platform }}</span>
        </span>
      </ErpListRow>
      <ErpListRow v-if="employeeStore.login" @click="copyText(employeeStore.login, 'Логин')">
        <span class="profile-kv">
          <span class="profile-kv__label">Логин</span>
          <span class="profile-kv__value">{{ employeeStore.login }}</span>
        </span>
        <template #trailing>
          <Icon name="heroicons:clipboard-document" size="16" class="profile-kv__icon"/>
        </template>
      </ErpListRow>
      <ErpListRow v-if="employeeStore.password" @click="copyText(employeeStore.password, 'Пароль')">
        <span class="profile-kv">
          <span class="profile-kv__label">Пароль</span>
          <span class="profile-kv__value profile-kv__value--mono">{{ employeeStore.password }}</span>
        </span>
        <template #trailing>
          <Icon name="heroicons:clipboard-document" size="16" class="profile-kv__icon"/>
        </template>
      </ErpListRow>
    </ErpGroupedList>
  </ErpScreen>

  <ErpScreen
      v-else
      title="Вход"
      icon="heroicons:user-circle"
      subtitle="Войдите со своим логином"
  >
    <div class="login-card">
      <form class="register-form" @submit.prevent="submit">
        <UiInput
            id="erp-login"
            v-model="loginField"
            label="Логин"
            autocomplete="username"
            required
            @keyup.enter="submit"
        />
        <UiInput
            id="erp-password"
            v-model="password"
            type="password"
            label="Пароль"
            autocomplete="current-password"
            required
            :error="error"
            @keyup.enter="submit"
        />
        <UiButton block :loading="isLoading" @click="submit">
          Войти
        </UiButton>
      </form>
    </div>
  </ErpScreen>
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
  background: rgba(255, 255, 255, 0.18)
  color: #fff
  cursor: pointer
  transition: opacity 0.15s ease

  &:hover
    opacity: 0.75

.hub-stats
  display: flex
  gap: 10px

.hub-stat
  flex: 1
  display: flex
  flex-direction: column
  gap: 1px
  padding: 10px 12px
  border-radius: 13px
  background: rgba(255, 255, 255, 0.16)

.hub-stat__num
  font-size: 22px
  font-weight: 800
  line-height: 1.1
  color: #fff
  font-variant-numeric: tabular-nums

.hub-stat__label
  font-size: 11px
  color: rgba(255, 255, 255, 0.85)

.hub-grid
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 10px

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

.login-card
  padding: 20px 16px
  border-radius: 18px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card)

.register-form
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
</style>
