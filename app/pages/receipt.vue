<script setup lang="ts">
import {formatBadgeDisplay} from '~/utils/erp-csv'
import {workshopLabel} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Получение бирки | ERP'})

const employeeStore = useErpEmployeeStore()
const sessionStore = useErpSessionStore()
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
  <ErpScreen title="Получение бирки" :shift-link="{ to: '/shift', label: 'Бирки за смену' }" icon="heroicons:tag">
    <p v-if="sessionStore.journalSkipped" class="erp-notice">
      Журнал не подключён. Настройте Web App на странице /erp-setup
    </p>

    <ErpGroupedList>
      <div class="erp-hero-card">
        <p class="erp-hero-card__eyebrow">Ваша бирка</p>
        <p class="erp-hero-card__title">{{ formatBadgeDisplay(badgeContent) }}</p>
        <p class="erp-hero-card__meta">{{ employeeStore.fio }} · {{ workshopTitle }}</p>
      </div>
    </ErpGroupedList>

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
  </ErpScreen>
</template>
