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
const query = ref('')

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

const filteredBadges = computed(() => {
    const needle = normalize(query.value)
    if (!needle) return badges.value
    return badges.value.filter(badge => normalize(badge).includes(needle))
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
    sessionStore.selectBadge(content)
    router.push('/receipt')
}

const changeWorkshop = () => {
    router.push('/workshop')
}

const clearQuery = () => {
    query.value = ''
}

onMounted(loadBadges)
</script>

<template>
  <CrmScreen
      title="Выбор бирки"
      :subtitle="`Цех: ${workshopTitle}`"
  >
    <template v-if="!isLoading && !error && badges.length > 0" #search>
      <div class="badges-search">
        <Icon name="heroicons:magnifying-glass" size="18" class="badges-search__icon"/>
        <input
            v-model="query"
            type="search"
            inputmode="search"
            class="badges-search__field"
            placeholder="Поиск по бирке…"
        >
        <button
            v-if="query"
            type="button"
            class="badges-search__clear"
            aria-label="Очистить поиск"
            @click="clearQuery"
        >
          <Icon name="heroicons:x-mark" size="16"/>
        </button>
      </div>
      <p class="badges-search__count">
        Найдено {{ filteredBadges.length }} из {{ badges.length }}
      </p>
    </template>

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
    </div>

    <div v-else-if="filteredBadges.length === 0" class="badges-state">
      <p>Ничего не найдено по запросу «{{ query }}»</p>
      <UiButton variant="outline" @click="clearQuery">Очистить поиск</UiButton>
    </div>

    <div v-else class="badge-list">
      <button
          v-for="badge in filteredBadges"
          :key="badge"
          type="button"
          class="badge-item"
          @click="selectBadge(badge)"
      >
        <span class="badge-item__text">{{ badge }}</span>
        <Icon name="heroicons:chevron-right" size="16"/>
      </button>
    </div>

    <template #footer>
      <UiButton variant="ghost" block @click="changeWorkshop">
        Сменить цех
      </UiButton>
    </template>
  </CrmScreen>
</template>

<style scoped lang="sass">
.badges-search
  position: relative
  display: flex
  align-items: center

.badges-search__icon
  position: absolute
  left: 12px
  color: var(--color-text-muted)
  pointer-events: none

.badges-search__field
  width: 100%
  height: 38px
  padding: 0 36px 0 38px
  border: var(--border-width) solid var(--color-input-border)
  border-radius: var(--radius-md)
  background-color: var(--color-input-bg)
  color: var(--color-input-text)
  font-size: var(--font-size-sm)
  appearance: none

  &::-webkit-search-cancel-button
    display: none

  &::placeholder
    color: var(--color-input-placeholder)

  &:focus-visible
    outline: none
    border-color: var(--color-input-border-focus)
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12)

.badges-search__clear
  position: absolute
  right: 8px
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
    color: var(--color-text)
    background-color: var(--color-bg-secondary)

.badges-search__count
  margin: var(--spacing-2) 0 0
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)

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
  white-space: pre-line

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
