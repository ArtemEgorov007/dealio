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
    } catch (copyError) {
        showError(copyError, 'Не удалось скопировать')
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
  <CrmScreen title="Получение бирки" :shift-link="{ to: '/shift', label: 'Бирки за смену' }" icon="heroicons:tag">
    <p v-if="sessionStore.journalSkipped" class="crm-notice">
      Журнал не подключён. Настройте Web App на странице /crm-setup
    </p>

    <CrmGroupedList>
      <div class="crm-hero-card">
        <p class="crm-hero-card__eyebrow">Ваша бирка</p>
        <p class="crm-hero-card__title">{{ formatBadgeDisplay(badgeContent) }}</p>
        <p class="crm-hero-card__meta">{{ employeeStore.fio }} · {{ workshopTitle }}</p>
      </div>
    </CrmGroupedList>

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
