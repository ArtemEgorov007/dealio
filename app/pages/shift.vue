<script setup lang="ts">
import {fetchIssuedBadgesToday} from '~/utils/crm-sheets'
import {formatBadgeDisplay} from '~/utils/crm-csv'
import {workshopLabel} from '~~/types/crm.types'
import type {CrmIssuedBadgeEntry} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Бирки за смену | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const entries = ref<CrmIssuedBadgeEntry[]>([])
const isLoading = ref(true)
const error = ref('')
const pendingDelete = ref<CrmIssuedBadgeEntry | null>(null)

const CHECKED_STORAGE_KEY = 'crm-shift-checked'

const todayDateKey = (): string => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const loadCheckedBadges = (): Set<string> => {
    if (!import.meta.client) return new Set()

    try {
        const raw = localStorage.getItem(CHECKED_STORAGE_KEY)
        if (!raw) return new Set()

        const parsed = JSON.parse(raw) as { date: string; badges: string[] }
        if (parsed.date !== todayDateKey()) return new Set()

        return new Set(parsed.badges)
    } catch {
        return new Set()
    }
}

const saveCheckedBadges = (badges: Set<string>) => {
    if (!import.meta.client) return
    localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify({date: todayDateKey(), badges: [...badges]}))
}

const checkedBadges = ref<Set<string>>(loadCheckedBadges())

const toggleChecked = (badge: string) => {
    const next = new Set(checkedBadges.value)
    if (next.has(badge)) next.delete(badge)
    else next.add(badge)
    checkedBadges.value = next
    saveCheckedBadges(next)
}

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

const load = async () => {
    isLoading.value = true
    error.value = ''

    try {
        entries.value = await fetchIssuedBadgesToday(employeeStore.fio, employeeStore.workshopId)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки'
    } finally {
        isLoading.value = false
    }
}

const goBack = () => {
    router.back()
}

const copyBadge = async (entry: CrmIssuedBadgeEntry) => {
    try {
        await navigator.clipboard.writeText(entry.badge)
        showSuccess('Скопировано в буфер обмена')
    } catch (copyError) {
        showError(copyError, 'Не удалось скопировать')
    }
}

const requestDelete = (entry: CrmIssuedBadgeEntry) => {
    pendingDelete.value = entry
}

const cancelDelete = () => {
    pendingDelete.value = null
}

const onDeleted = (entry: CrmIssuedBadgeEntry) => {
    entries.value = entries.value.filter(item => item.row !== entry.row)
    pendingDelete.value = null
}

onMounted(load)
</script>

<template>
  <CrmScreen
      title="Бирки за смену"
      :subtitle="workshopTitle ? `${employeeStore.fio} · ${workshopTitle}` : employeeStore.fio"
      icon="heroicons:tag"
  >
    <CrmEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </CrmEmptyState>

    <CrmEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </CrmEmptyState>

    <CrmEmptyState v-else-if="entries.length === 0">
      <p>За смену бирки пока не выдавались</p>
    </CrmEmptyState>

    <template v-else>
      <CrmSectionLabel>Выдано сегодня: {{ entries.length }}</CrmSectionLabel>

      <CrmGroupedList>
        <CrmListRow
            v-for="entry in entries"
            :key="entry.row"
            tag="article"
            multiline
        >
          <template #leading>
            <input
                type="checkbox"
                class="crm-ios-check"
                :checked="checkedBadges.has(entry.badge)"
                aria-label="Отметить как обработано"
                @change="toggleChecked(entry.badge)"
            >
          </template>

          <span class="shift-row">
            <span class="shift-row__time">{{ entry.time }}</span>
            <span class="shift-row__badge">{{ formatBadgeDisplay(entry.badge) }}</span>
          </span>

          <template #trailing>
            <button
                type="button"
                class="crm-row-action"
                aria-label="Скопировать бирку"
                @click.stop="copyBadge(entry)"
            >
              <Icon name="heroicons:clipboard-document" size="16"/>
            </button>
            <button
                type="button"
                class="crm-row-action crm-row-action--danger"
                aria-label="Удалить бирку"
                @click.stop="requestDelete(entry)"
            >
              <Icon name="heroicons:trash" size="16"/>
            </button>
          </template>
        </CrmListRow>
      </CrmGroupedList>
    </template>

    <template #footer>
      <UiButton block variant="outline" @click="goBack">
        Назад
      </UiButton>
    </template>
  </CrmScreen>

  <CrmDeleteBadgeSheet
      :entry="pendingDelete"
      @deleted="onDeleted"
      @cancel="cancelDelete"
  />
</template>

<style scoped lang="sass">
.shift-row
  display: flex
  flex-direction: column
  gap: 2px
  min-width: 0

.shift-row__time
  font-size: 13px
  color: var(--color-text-secondary)

.shift-row__badge
  font-size: 15px
  line-height: 1.35
  white-space: pre-line
</style>
