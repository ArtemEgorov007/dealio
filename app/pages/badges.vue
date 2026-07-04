<script setup lang="ts">
import {fetchWorkshopBadges} from '~/utils/erp-sheets'
import {formatBadgeDisplay} from '~/utils/erp-csv'
import {workshopLabel} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Выбор бирки | ERP'})

const employeeStore = useErpEmployeeStore()
const sessionStore = useErpSessionStore()
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
  <ErpScreen
      title="Выбор бирки"
      :subtitle="`Цех: ${workshopTitle}`"
      :shift-link="{ to: '/shift', label: 'Бирки за смену' }"
      icon="heroicons:tag"
  >
    <template v-if="!isLoading && !error && badges.length > 0" #search>
      <ErpSearchBar
          v-model="query"
          placeholder="Поиск по бирке"
          :count-label="searchCountLabel"
      />
    </template>

    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка списка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="loadBadges">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="badges.length === 0">
      <p>Для цеха «{{ workshopTitle }}» бирки не найдены</p>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="filteredBadges.length === 0">
      <p>Ничего не найдено по запросу «{{ query }}»</p>
      <UiButton variant="outline" @click="query = ''">Очистить поиск</UiButton>
    </ErpEmptyState>

    <ErpGroupedList v-else>
      <ErpListRow
          v-for="badge in filteredBadges"
          :key="badge"
          chevron
          multiline
          @click="selectBadge(badge)"
      >
        {{ formatBadgeDisplay(badge) }}
      </ErpListRow>
    </ErpGroupedList>

    <template #footer>
      <UiButton variant="ghost" block @click="changeWorkshop">
        Сменить цех
      </UiButton>
    </template>
  </ErpScreen>

  <ErpBadgeConfirmSheet
      :badge="pendingBadge"
      @issued="onBadgeIssued"
      @cancel="cancelPendingBadge"
  />
</template>
