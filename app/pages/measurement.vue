<script setup lang="ts">
import {recordMeasurement} from '~/utils/crm-sheets'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useCrmSessionStore} from '~~/store/crm-session.store'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Промеры — ввод | CRM'})

const employeeStore = useCrmEmployeeStore()
const sessionStore = useCrmSessionStore()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const COVERAGE_OPTIONS = ['ТИ', 'ОЗ', 'ТИ+ОЗ'] as const
type Coverage = typeof COVERAGE_OPTIONS[number]

const badge = computed(() => sessionStore.measurementBadge)

const coverage = ref<Coverage | null>(null)
const zones = ref<string[]>(['', '', '', '', ''])
const isLoading = ref(false)

const zone1Error = computed(() => {
    if (zones.value[0] && !/^\d+$/.test(zones.value[0].trim())) return 'Только целые числа'
    return ''
})

const canSubmit = computed(() =>
    coverage.value !== null
    && zones.value[0].trim() !== ''
    && !zone1Error.value,
)

const submit = async () => {
    if (!canSubmit.value) return

    isLoading.value = true

    try {
        const parsed = zones.value.map(z => {
            const trimmed = z.trim()
            return trimmed ? parseInt(trimmed, 10) : null
        }) as (number | null)[]

        await recordMeasurement(employeeStore.fio, badge.value, coverage.value!, parsed)
        showSuccess('Промер записан', badge.value)
        sessionStore.clearMeasurementBadge()
        router.push('/scan-measurement')
    } catch (error) {
        showError(error, 'Не удалось записать промер')
    } finally {
        isLoading.value = false
    }
}

const goBack = () => {
    router.push('/scan-measurement')
}

onMounted(() => {
    if (!sessionStore.hasMeasurementBadge) {
        router.replace('/scan-measurement')
    }
})
</script>

<template>
  <CrmScreen
      title="Промеры"
      icon="heroicons:beaker"
  >
    <div class="measurement-badge">
      <span class="measurement-badge__label">Бирка</span>
      <span class="measurement-badge__value">{{ badge }}</span>
    </div>

    <div class="measurement-section">
      <p class="measurement-section__title">Покрытие</p>
      <div class="coverage-btns">
        <button
            v-for="opt in COVERAGE_OPTIONS"
            :key="opt"
            type="button"
            class="coverage-btn"
            :class="{ 'coverage-btn--active': coverage === opt }"
            @click="coverage = opt"
        >
          {{ opt }}
        </button>
      </div>
    </div>

    <div class="measurement-section">
      <p class="measurement-section__title">Укажите среднюю толщину для зоны конструкции</p>

      <div class="zones">
        <UiInput
            id="zone-1"
            v-model="zones[0]"
            label="Зона 1 *"
            inputmode="numeric"
            :error="zone1Error"
        />
        <UiInput
            id="zone-2"
            v-model="zones[1]"
            label="Зона 2"
            inputmode="numeric"
        />
        <UiInput
            id="zone-3"
            v-model="zones[2]"
            label="Зона 3"
            inputmode="numeric"
        />
        <UiInput
            id="zone-4"
            v-model="zones[3]"
            label="Зона 4"
            inputmode="numeric"
        />
        <UiInput
            id="zone-5"
            v-model="zones[4]"
            label="Зона 5"
            inputmode="numeric"
        />
      </div>
    </div>

    <template #footer>
      <UiButton
          block
          :loading="isLoading"
          :disabled="!canSubmit"
          @click="submit"
      >
        Записать
      </UiButton>
      <UiButton block variant="ghost" @click="goBack">
        Назад
      </UiButton>
    </template>
  </CrmScreen>
</template>

<style scoped lang="sass">
.measurement-badge
  display: flex
  align-items: baseline
  gap: var(--spacing-3)
  padding: 14px 16px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  background-color: var(--color-card-bg)

.measurement-badge__label
  flex-shrink: 0
  font-size: var(--font-size-xs)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.4px
  color: var(--color-text-muted)

.measurement-badge__value
  flex: 1
  min-width: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.measurement-section
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.measurement-section__title
  margin: 0
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text-secondary)

.coverage-btns
  display: flex
  gap: var(--spacing-2)

.coverage-btn
  flex: 1
  padding: 10px 8px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-md)
  background-color: var(--color-card-bg)
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 600
  cursor: pointer
  transition: border-color var(--transition-normal) ease, background-color var(--transition-normal) ease, color var(--transition-normal) ease

  &:hover
    border-color: var(--color-border-hover)

  &--active
    border-color: var(--color-primary)
    background-color: var(--color-primary-light)
    color: var(--color-primary)

.zones
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
</style>
