<script setup lang="ts">
import {appendBadgeJournalEntry} from '~/utils/crm-sheets'
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

type Phase = 'confirm' | 'saving' | 'done' | 'error'

// Если бирка уже была выдана в этой сессии (например, вернулись на
// экран кнопкой «вперёд» в браузере) — повторно в журнал не пишем.
const phase = ref<Phase>(sessionStore.issued ? 'done' : 'confirm')
const saveError = ref('')
const saveWarning = ref('')

const badgeContent = computed(() => sessionStore.selectedBadge)
const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

const confirmIssue = async () => {
    if (!employeeStore.workshopId) return

    phase.value = 'saving'
    saveError.value = ''
    saveWarning.value = ''

    try {
        const result = await appendBadgeJournalEntry({
            workshopId: employeeStore.workshopId,
            fio: employeeStore.fio,
            badgeContent: badgeContent.value,
        })

        if (result === 'skipped') {
            saveWarning.value = 'Журнал не подключён. Настройте Web App на странице /crm-setup'
        }

        sessionStore.markIssued()
        phase.value = 'done'
    } catch (error) {
        saveError.value = error instanceof Error ? error.message : 'Не удалось записать в журнал'
        phase.value = 'error'
    }
}

const rejectBadge = () => {
    sessionStore.clearSelectedBadge()
    router.push('/badges')
}

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
    <div v-if="phase === 'saving'" class="receipt-state">
      <div class="spinner"></div>
      <span>Запись в журнал…</span>
    </div>

    <template v-else>
      <p v-if="phase === 'error'" class="receipt-error">{{ saveError }}</p>
      <p v-if="saveWarning" class="receipt-warning">{{ saveWarning }}</p>

      <article class="badge-card">
        <p class="badge-card__label">{{ phase === 'confirm' ? 'Выдать бирку' : 'Ваша бирка' }}</p>
        <p class="badge-card__content">{{ formatBadgeDisplay(badgeContent) }}</p>
        <p class="badge-card__meta">{{ employeeStore.fio }} · {{ workshopTitle }}</p>
      </article>
    </template>

    <template v-if="phase === 'confirm'" #footer>
      <UiButton block @click="confirmIssue">
        Подтвердить выдачу
      </UiButton>
      <UiButton block variant="outline" @click="rejectBadge">
        Это не та бирка
      </UiButton>
    </template>

    <template v-else-if="phase === 'error'" #footer>
      <UiButton block @click="confirmIssue">
        Повторить
      </UiButton>
      <UiButton block variant="outline" @click="changeWorkshop">
        Сменить цех
      </UiButton>
    </template>

    <template v-else-if="phase === 'done'" #footer>
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
.receipt-state
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--spacing-3)
  padding: var(--spacing-10) 0
  color: var(--color-text-secondary)

.receipt-error
  margin: 0
  padding: 10px 12px
  border-radius: var(--radius-md)
  background-color: rgba(239, 68, 68, 0.1)
  color: var(--color-danger)
  font-size: var(--font-size-sm)

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
