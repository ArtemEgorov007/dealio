<script setup lang="ts">
import {fetchIssuedBadgesToday} from '~/utils/erp-sheets'
import {formatBadgeDisplay} from '~/utils/erp-csv'
import {workshopLabel} from '~~/types/erp.types'
import type {ErpIssuedBadgeEntry} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Бирки за смену | ERP'})

const employeeStore = useErpEmployeeStore()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const entries = ref<ErpIssuedBadgeEntry[]>([])
const isLoading = ref(true)
const error = ref('')
const pendingDelete = ref<ErpIssuedBadgeEntry | null>(null)

const CHECKED_STORAGE_KEY = 'erp-shift-checked'

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

const copyBadge = async (entry: ErpIssuedBadgeEntry) => {
    try {
        await navigator.clipboard.writeText(entry.badge)
        showSuccess('Скопировано в буфер обмена')
        // Скопировал — значит обработал: отмечаем бирку галочкой
        if (!checkedBadges.value.has(entry.badge)) toggleChecked(entry.badge)
    } catch (copyError) {
        showError(copyError, 'Не удалось скопировать')
    }
}

const requestDelete = (entry: ErpIssuedBadgeEntry) => {
    pendingDelete.value = entry
}

const cancelDelete = () => {
    pendingDelete.value = null
}

const onDeleted = (entry: ErpIssuedBadgeEntry) => {
    entries.value = entries.value.filter(item => item.row !== entry.row)
    pendingDelete.value = null
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Бирки за смену"
      :subtitle="workshopTitle ? `${employeeStore.fio} · ${workshopTitle}` : employeeStore.fio"
      icon="heroicons:tag"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="entries.length === 0">
      <p>За смену бирки пока не выдавались</p>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Выдано сегодня: {{ entries.length }}</ErpSectionLabel>

      <ErpGroupedList>
        <ErpListRow
            v-for="entry in entries"
            :key="entry.row"
            tag="article"
            multiline
        >
          <template #leading>
            <input
                type="checkbox"
                class="erp-ios-check"
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
                class="erp-row-action"
                aria-label="Скопировать бирку"
                @click.stop="copyBadge(entry)"
            >
              <Icon name="heroicons:clipboard-document" size="16"/>
            </button>
            <button
                type="button"
                class="erp-row-action erp-row-action--danger"
                aria-label="Удалить бирку"
                @click.stop="requestDelete(entry)"
            >
              <Icon name="heroicons:trash" size="16"/>
            </button>
          </template>
        </ErpListRow>
      </ErpGroupedList>
    </template>

    <template #footer>
      <UiButton block variant="outline" @click="goBack">
        Назад
      </UiButton>
    </template>
  </ErpScreen>

  <ErpDeleteBadgeSheet
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
