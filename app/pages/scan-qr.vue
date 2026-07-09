<script setup lang="ts">
import type QrScanner from 'qr-scanner'
import type {ErpPackingEntry} from '~~/types/erp.types'
import {recordPackingEntry, fetchPackingToday} from '~/utils/erp-sheets'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useAppToast} from '~/composables/useAppToast'
import {useHaptics} from '~/composables/useHaptics'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Считывание QR | ERP'})

const employeeStore = useErpEmployeeStore()
const {showSuccess, showError} = useAppToast()
const {vibrate} = useHaptics()

const MACHINE_NUMBERS = Array.from({length: 10}, (_, i) => String(i + 1))
const machine = ref(MACHINE_NUMBERS[0])

const packingEntries = ref<ErpPackingEntry[]>([])
const isLoadingEntries = ref(false)

const totalCount = computed(() => packingEntries.value.length)
const totalWeight = computed(() => packingEntries.value.reduce((sum, entry) => sum + entry.weight, 0))

const formatWeight = (value: number) =>
    value.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})

const loadPackingEntries = async () => {
    if (!employeeStore.hasFio) return

    isLoadingEntries.value = true
    try {
        packingEntries.value = await fetchPackingToday(employeeStore.fio, machine.value)
    } catch {
        packingEntries.value = []
    } finally {
        isLoadingEntries.value = false
    }
}

onMounted(loadPackingEntries)
watch(machine, loadPackingEntries)

type Status = 'starting' | 'scanning' | 'saving' | 'unsupported' | 'denied'

const status = ref<Status>('starting')
const videoEl = ref<HTMLVideoElement | null>(null)

let scanner: QrScanner | null = null
let lastCode = ''
let lastScannedAt = 0
const DEDUPE_WINDOW_MS = 4000

const onDecode = async (qrText: string) => {
    if (!qrText) return

    if (status.value === 'saving') {
        if (qrText !== lastCode) showError(null, 'Идёт запись предыдущей бирки — поднесите эту ещё раз')
        return
    }

    const now = Date.now()
    if (qrText === lastCode && now - lastScannedAt < DEDUPE_WINDOW_MS) return

    lastCode = qrText
    lastScannedAt = now

    vibrate(15)
    status.value = 'saving'

    try {
        await recordPackingEntry(employeeStore.platform, employeeStore.fio, machine.value, qrText)
        vibrate(200)
        showSuccess('Упаковка записана', qrText)
        await loadPackingEntries()
    } catch (error) {
        vibrate([100, 50, 100])
        showError(error, 'Не удалось записать упаковку')
    } finally {
        status.value = 'scanning'
    }
}

onMounted(async () => {
    if (!import.meta.client || !videoEl.value) return

    const {default: QrScannerCtor} = await import('qr-scanner')

    const hasCamera = await QrScannerCtor.hasCamera()
    if (!hasCamera) {
        status.value = 'unsupported'
        return
    }

    scanner = new QrScannerCtor(
        videoEl.value,
        result => onDecode(result.data),
        {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment',
            onDecodeError: () => {},
        },
    )

    try {
        await scanner.start()
        status.value = 'scanning'
    } catch {
        status.value = 'denied'
    }
})

onBeforeUnmount(() => {
    scanner?.destroy()
    scanner = null
})
</script>

<template>
  <ErpScreen
      title="Считывание QR"
      :subtitle="`Упаковка · Площадка: ${employeeStore.platform}`"
      icon="heroicons:qr-code"
  >
    <ErpSectionLabel>Машина</ErpSectionLabel>
    <div class="machine-row">
      <button
          v-for="opt in MACHINE_NUMBERS"
          :key="opt"
          type="button"
          class="machine-opt"
          :class="{ 'machine-opt--active': machine === opt }"
          @click="machine = opt"
      >
        {{ opt }}
      </button>
    </div>

    <div class="erp-scan-viewport erp-scan-viewport--compact">
      <video ref="videoEl" class="erp-scan-video" muted playsinline/>

      <div v-if="status === 'saving'" class="erp-scan-overlay">
        <ErpEmptyState loading/>
        <span>Записываем…</span>
      </div>

      <div v-if="status === 'unsupported'" class="erp-scan-overlay">
        <p>Камера не найдена на этом устройстве</p>
      </div>

      <div v-if="status === 'denied'" class="erp-scan-overlay">
        <p>Нет доступа к камере — разрешите доступ в настройках браузера и обновите страницу</p>
      </div>
    </div>

    <p class="erp-scan-hint">Наведите камеру на QR-код бирки на упаковке</p>

    <ErpSectionLabel>Упаковано на машину {{ machine }} сегодня</ErpSectionLabel>
    <ErpEmptyState v-if="isLoadingEntries" loading/>
    <ErpEmptyState v-else-if="packingEntries.length === 0">
      <p>Пока нет записей на эту машину за сегодня</p>
    </ErpEmptyState>
    <template v-else>
      <div class="pack-table">
        <div class="pack-row pack-row--head">
          <span>Титул и марка</span>
          <span class="pack-row__num">Вес</span>
        </div>
        <div v-for="(entry, index) in packingEntries" :key="index" class="pack-row">
          <span>{{ entry.titleAndMark }}</span>
          <span class="pack-row__num">{{ formatWeight(entry.weight) }}</span>
        </div>
      </div>
      <div class="pack-totals">
        <span>Записей: {{ totalCount }}</span>
        <span>Вес: {{ formatWeight(totalWeight) }}</span>
      </div>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.erp-scan-video
  width: 100%
  height: 100%
  object-fit: cover

.erp-scan-overlay
  position: absolute
  inset: 0
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: 12px
  padding: 16px
  text-align: center
  color: #fff
  background-color: rgba(0, 0, 0, 0.55)
  font-size: 15px
  line-height: 1.4

.erp-scan-viewport--compact
  max-width: 200px
  margin: 0 auto

.machine-row
  display: flex
  flex-wrap: wrap
  gap: 2px
  background: var(--color-bg)
  border-radius: 9px
  padding: 2px
  margin-bottom: var(--spacing-3)

.machine-opt
  flex: 1 1 18%
  min-width: 40px
  padding: 7px 8px
  border: none
  border-radius: 7px
  background: transparent
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 500
  cursor: pointer

  &--active
    background: var(--color-card-bg)
    color: var(--color-text)
    font-weight: 600
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0.5px 1px rgba(0, 0, 0, 0.06)

// Тот же язык карточки, что у таблицы Баланс (мягкая тень, без рамки)
.pack-table
  border-radius: 14px
  overflow: hidden
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.pack-row
  display: grid
  grid-template-columns: 1.8fr 0.7fr
  gap: 6px
  padding: 9px 12px
  font-size: 12.5px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.15)
  align-items: center

  &:last-child
    border-bottom: none

  &--head
    background: var(--color-bg)
    font-weight: 700
    color: var(--color-text-secondary)
    font-size: 10.5px
    text-transform: uppercase
    letter-spacing: 0.3px

.pack-row__num
  text-align: right
  font-variant-numeric: tabular-nums
  font-weight: 700

.pack-totals
  display: flex
  justify-content: space-between
  margin-top: 8px
  padding: 0 4px
  font-size: 13px
  font-weight: 700
  color: var(--color-text)
  font-variant-numeric: tabular-nums
</style>
