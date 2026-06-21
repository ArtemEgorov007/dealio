<script setup lang="ts">
import {fetchIssuedBadgesToday} from '~/utils/crm-sheets'
import {formatBadgeDisplay} from '~/utils/crm-csv'
import {workshopLabel} from '~~/types/crm.types'
import type {CrmIssuedBadgeEntry} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Бирки за смену | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()

const entries = ref<CrmIssuedBadgeEntry[]>([])
const isLoading = ref(true)
const error = ref('')

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

onMounted(load)
</script>

<template>
  <CrmScreen
      title="Бирки за смену"
      :subtitle="workshopTitle ? `${employeeStore.fio} · ${workshopTitle}` : employeeStore.fio"
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
        <article v-for="(entry, index) in entries" :key="`${entry.badge}-${index}`" class="shift-item">
          <span class="shift-item__time">{{ entry.time }}</span>
          <span class="shift-item__badge">{{ formatBadgeDisplay(entry.badge) }}</span>
        </article>
      </div>
    </template>

    <template #footer>
      <UiButton block variant="outline" @click="goBack">
        Назад
      </UiButton>
    </template>
  </CrmScreen>
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
  align-items: baseline
  gap: var(--spacing-3)
  padding: 14px 16px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-md)
  background-color: var(--color-card-bg)

.shift-item__time
  flex-shrink: 0
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
