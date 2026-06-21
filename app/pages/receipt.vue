<script setup lang="ts">
import {formatBadgeDisplay} from '~/utils/crm-csv'
import {workshopLabel} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useCrmSessionStore} from '~~/store/crm-session.store'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Получение бирки | CRM'})

const employeeStore = useCrmEmployeeStore()
const sessionStore = useCrmSessionStore()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const badgeContent = computed(() => sessionStore.selectedBadge)
const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

const copyBadge = async () => {
    try {
        await navigator.clipboard.writeText(badgeContent.value)
        showSuccess('Скопировано в буфер обмена')
    } catch {
        showError('Не удалось скопировать')
    }
}

const continueFlow = () => {
    sessionStore.clearSelectedBadge()
    router.push('/badges')
}

const changeWorkshop = () => {
    sessionStore.clearSelectedBadge()
    router.push('/workshop')
}
</script>

<template>
  <CrmScreen title="Получение бирки">
    <p v-if="sessionStore.journalSkipped" class="receipt-warning">
      Журнал не подключён. Настройте Web App на странице /crm-setup
    </p>

    <article class="badge-card">
      <p class="badge-card__label">Ваша бирка</p>
      <p class="badge-card__content">{{ formatBadgeDisplay(badgeContent) }}</p>
      <p class="badge-card__meta">{{ employeeStore.fio }} · {{ workshopTitle }}</p>
    </article>

    <template #footer>
      <UiButton block @click="copyBadge">
        Скопировать
      </UiButton>
      <UiButton block variant="secondary" @click="continueFlow">
        Продолжить
      </UiButton>
      <UiButton block variant="outline" @click="changeWorkshop">
        Сменить цех
      </UiButton>
    </template>
  </CrmScreen>
</template>

<style scoped lang="sass">
.receipt-warning
  margin: 0
  padding: 10px 12px
  border-radius: var(--radius-md)
  background-color: rgba(234, 179, 8, 0.12)
  color: var(--color-text)
  font-size: var(--font-size-sm)

.badge-card
  padding: var(--spacing-5)
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  background-color: var(--color-card-bg)

.badge-card__label
  margin: 0 0 var(--spacing-2)
  font-size: var(--font-size-xs)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  color: var(--color-text-muted)

.badge-card__content
  margin: 0 0 var(--spacing-3)
  font-size: var(--font-size-xl)
  font-weight: 700
  line-height: 1.35
  overflow-wrap: anywhere

.badge-card__meta
  margin: 0
  font-size: var(--font-size-sm)
  color: var(--color-text-secondary)
</style>
