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

const zoneError = (value: string | undefined) => {
    const v = (value ?? '').trim()
    return v && !/^\d+$/.test(v) ? 'Только целые числа' : ''
}

const zone1Error = computed(() => zoneError(zones.value[0]))
const zone2Error = computed(() => zoneError(zones.value[1]))
const zone3Error = computed(() => zoneError(zones.value[2]))
const zone4Error = computed(() => zoneError(zones.value[3]))
const zone5Error = computed(() => zoneError(zones.value[4]))

const canSubmit = computed(() =>
    !isLoading.value
    && coverage.value !== null
    && (zones.value[0] ?? '').trim() !== ''
    && !zone1Error.value
    && !zone2Error.value
    && !zone3Error.value
    && !zone4Error.value
    && !zone5Error.value,
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
            :error="zone2Error"
        />
        <UiInput
            id="zone-3"
            v-model="zones[2]"
            label="Зона 3"
            inputmode="numeric"
            :error="zone3Error"
        />
        <UiInput
            id="zone-4"
            v-model="zones[3]"
            label="Зона 4"
            inputmode="numeric"
            :error="zone4Error"
        />
        <UiInput
            id="zone-5"
            v-model="zones[4]"
            label="Зона 5"
            inputmode="numeric"
            :error="zone5Error"
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
  align-items: center
  gap: var(--spacing-3)
  padding: 14px 16px
  border-radius: 13px
  background-color: var(--color-card-bg)
  box-shadow: 0 1px 0 rgba(0,0,0,0.04)

.measurement-badge__label
  flex-shrink: 0
  font-size: 11px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.5px
  color: var(--color-text-secondary)

.measurement-badge__value
  flex: 1
  min-width: 0
  font-size: var(--font-size-base)
  font-weight: 500
  white-space: pre-line
  line-height: 1.4
  color: var(--color-text)

.measurement-section
  display: flex
  flex-direction: column
  gap: var(--spacing-2)

.measurement-section__title
  margin: 0 0 0 4px
  font-size: 13px
  font-weight: 500
  color: var(--color-text-secondary)
  text-transform: uppercase
  letter-spacing: 0.3px

.coverage-btns
  display: flex
  gap: 2px
  background: rgba(118, 118, 128, 0.12)
  border-radius: 9px
  padding: 2px

.coverage-btn
  flex: 1
  padding: 7px 8px
  border: none
  border-radius: 7px
  background: transparent
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 500
  cursor: pointer
  transition: background-color 0.2s ease, box-shadow 0.2s ease, color 0.1s ease

  &--active
    background: #FFFFFF
    color: var(--color-text)
    font-weight: 600
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0.5px 1px rgba(0, 0, 0, 0.06)

.zones
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  background: var(--color-card-bg)
  border-radius: 13px
  padding: 4px 16px
  box-shadow: 0 1px 0 rgba(0,0,0,0.04)
</style>
