<script setup lang="ts">
import {fetchWorkshopBadges} from '~/utils/crm-sheets'
import {formatBadgeDisplay} from '~/utils/crm-csv'
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
const query = ref('')
const pendingBadge = ref<string | null>(null)

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const filteredBadges = computed(() => {
    const needle = normalize(query.value)
    if (!needle) return badges.value
    return badges.value.filter(badge => normalize(badge).includes(needle))
})

const searchCountLabel = computed(() => {
    if (!badges.value.length) return ''
    return `Найдено ${filteredBadges.value.length} из ${badges.value.length}`
})

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
    pendingBadge.value = content
}

const cancelPendingBadge = () => {
    pendingBadge.value = null
}

const onBadgeIssued = (skippedJournal: boolean) => {
    if (!pendingBadge.value) return
    sessionStore.selectBadge(pendingBadge.value)
    sessionStore.markIssued(skippedJournal)
    pendingBadge.value = null
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
      :shift-link="{ to: '/shift', label: 'Бирки за смену' }"
      icon="heroicons:tag"
  >
    <template v-if="!isLoading && !error && badges.length > 0" #search>
      <CrmSearchBar
          v-model="query"
          placeholder="Поиск по бирке"
          :count-label="searchCountLabel"
      />
    </template>

    <CrmEmptyState v-if="isLoading" loading>
      <span>Загрузка списка…</span>
    </CrmEmptyState>

    <CrmEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="loadBadges">Повторить</UiButton>
    </CrmEmptyState>

    <CrmEmptyState v-else-if="badges.length === 0">
      <p>Для цеха «{{ workshopTitle }}» бирки не найдены</p>
    </CrmEmptyState>

    <CrmEmptyState v-else-if="filteredBadges.length === 0">
      <p>Ничего не найдено по запросу «{{ query }}»</p>
      <UiButton variant="outline" @click="query = ''">Очистить поиск</UiButton>
    </CrmEmptyState>

    <CrmGroupedList v-else>
      <CrmListRow
          v-for="badge in filteredBadges"
          :key="badge"
          chevron
          multiline
          @click="selectBadge(badge)"
      >
        {{ formatBadgeDisplay(badge) }}
      </CrmListRow>
    </CrmGroupedList>

    <template #footer>
      <UiButton variant="ghost" block @click="changeWorkshop">
        Сменить цех
      </UiButton>
    </template>
  </CrmScreen>

  <CrmBadgeConfirmSheet
      :badge="pendingBadge"
      @issued="onBadgeIssued"
      @cancel="cancelPendingBadge"
  />
</template>
