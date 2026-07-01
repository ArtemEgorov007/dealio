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

// Чек-боксы «обработано» — храним по дате, чтобы автоматически сбрасывались
// на следующий день (не нужно отдельной очистки/крон-задачи). Ключ — текст
// бирки, а не row: row сдвигается при удалении других строк журнала.
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

const isChecked = (badge: string) => checkedBadges.value.has(badge)

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
        // showError ждёт error/fallback, а не готовую строку — иначе
        // instanceof Error проверка внутри не срабатывает и тост
        // показывает общее «Что-то пошло не так» вместо нужного текста.
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
    <div v-if="isLoading" class="shift-state">
      <div class="spinner"/>
      <span>Загрузка…</span>
    </div>

    <div v-else-if="error" class="shift-state shift-state--error">
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </div>

    <div v-else-if="entries.length === 0" class="shift-state">
      <p>За смену бирки пока не выдавались</p>
    </div>

    <template v-else>
      <p class="shift-count">Выдано сегодня: {{ entries.length }}</p>

      <div class="shift-list">
        <article v-for="entry in entries" :key="entry.row" class="shift-item">
          <input
              type="checkbox"
              class="shift-item__checkbox"
              :checked="isChecked(entry.badge)"
              aria-label="Отметить как обработано"
              @change="toggleChecked(entry.badge)"
          >
          <span class="shift-item__time">{{ entry.time }}</span>
          <span class="shift-item__badge">{{ formatBadgeDisplay(entry.badge) }}</span>
          <button
              type="button"
              class="shift-item__action"
              aria-label="Скопировать бирку"
              @click="copyBadge(entry)"
          >
            <Icon name="heroicons:clipboard-document" size="16"/>
          </button>
          <button
              type="button"
              class="shift-item__action shift-item__action--delete"
              aria-label="Удалить бирку"
              @click="requestDelete(entry)"
          >
            <Icon name="heroicons:x-mark" size="16"/>
          </button>
        </article>
      </div>
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
.shift-state
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

.shift-count
  margin: 0
  font-size: var(--font-size-xs)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  color: var(--color-text-muted)

.shift-list
  display: flex
  flex-direction: column
  gap: var(--spacing-2)

.shift-item
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: 14px 16px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-md)
  background-color: var(--color-card-bg)

.shift-item__checkbox
  flex-shrink: 0
  width: 20px
  height: 20px
  accent-color: var(--color-primary)
  cursor: pointer

.shift-item__time
  flex-shrink: 0
  align-self: baseline
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-muted)

.shift-item__badge
  flex: 1
  min-width: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  line-height: 1.4
  white-space: pre-line

.shift-item__action
  flex-shrink: 0
  display: flex
  align-items: center
  justify-content: center
  width: 28px
  height: 28px
  border: none
  border-radius: var(--radius-sm)
  background: none
  color: var(--color-text-muted)
  cursor: pointer

  &:hover
    color: var(--color-primary)
    background-color: var(--color-primary-light)

  &--delete:hover
    color: var(--color-danger)
    background-color: rgba(239, 68, 68, 0.1)

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
