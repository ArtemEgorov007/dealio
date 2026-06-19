<script setup lang="ts">
import {fetchWorkshopBadges} from '~/utils/crm-sheets'
import {workshopLabel} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useCrmSessionStore} from '~~/store/crm-session.store'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Выбор бирки | CRM'})

const employeeStore = useCrmEmployeeStore()
const sessionStore = useCrmSessionStore()
const router = useRouter()

const badges = ref<string[]>([])
const isLoading = ref(true)
const error = ref('')

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

const loadBadges = async () => {
    if (!employeeStore.workshopId) return

    isLoading.value = true
    error.value = ''

    try {
        badges.value = await fetchWorkshopBadges(employeeStore.workshopId)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки бирок'
    } finally {
        isLoading.value = false
    }
}

const selectBadge = (content: string) => {
    sessionStore.selectBadge(content)
    router.push('/receipt')
}

const changeWorkshop = () => {
    router.push('/workshop')
}

onMounted(loadBadges)
</script>

<template>
  <CrmScreen
      title="Выбор бирки"
      :subtitle="`Цех: ${workshopTitle}`"
  >
    <div v-if="isLoading" class="badges-state">
      <div class="spinner"></div>
      <span>Загрузка списка…</span>
    </div>

    <div v-else-if="error" class="badges-state badges-state--error">
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="loadBadges">Повторить</UiButton>
    </div>

    <div v-else-if="badges.length === 0" class="badges-state">
      <p>Для цеха «{{ workshopTitle }}» бирки не найдены</p>
      <UiButton variant="outline" @click="changeWorkshop">Сменить цех</UiButton>
    </div>

    <div v-else class="badge-list">
      <button
          v-for="badge in badges"
          :key="badge"
          type="button"
          class="badge-item"
          @click="selectBadge(badge)"
      >
        <span class="badge-item__text">{{ badge }}</span>
        <Icon name="heroicons:chevron-right" size="16"/>
      </button>
    </div>

    <UiButton variant="ghost" block @click="changeWorkshop">
      Сменить цех
    </UiButton>
  </CrmScreen>
</template>

<style scoped lang="sass">
.badges-state
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-3)
  padding: var(--spacing-8) var(--spacing-3)
  color: var(--color-text-secondary)
  text-align: center

  &--error
    color: var(--color-danger)

.badge-list
  display: flex
  flex-direction: column
  gap: var(--spacing-2)

.badge-item
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  width: 100%
  padding: 14px 16px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-md)
  background-color: var(--color-card-bg)
  color: var(--color-text)
  cursor: pointer
  text-align: left
  transition: background-color var(--transition-fast) ease, border-color var(--transition-fast) ease

  &:hover
    background-color: var(--color-bg-tertiary)
    border-color: var(--color-border-hover)

.badge-item__text
  flex: 1
  min-width: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  line-height: 1.4

.spinner
  width: 28px
  height: 28px
  border: 2px solid var(--color-border)
  border-top-color: var(--color-primary)
  border-radius: 50%
  animation: spin 0.8s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)
</style>
