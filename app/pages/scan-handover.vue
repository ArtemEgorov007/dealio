<script setup lang="ts">
import type QrScanner from 'qr-scanner'
import {recordHandoverEntry, fetchHandedOverBadgesToday} from '~/utils/erp-sheets'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useAppToast} from '~/composables/useAppToast'
import {useHaptics} from '~/composables/useHaptics'
import {getShiftCounterScope} from '~/utils/shift-counter-scope'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Сдача работ | ERP'})

const employeeStore = useErpEmployeeStore()
const {showSuccess, showError} = useAppToast()
const {vibrate} = useHaptics()

// Живой счётчик сданных за смену работ — перенесён сюда из Профиля по правке руководства
const handedCount = ref<number | null>(null)

const loadHandedCount = async () => {
    if (!employeeStore.hasFio) return
    try {
        const scope = getShiftCounterScope(employeeStore.role, employeeStore.fio)
        handedCount.value = (await fetchHandedOverBadgesToday(scope.fio ?? '')).length
    } catch {
        handedCount.value = null
    }
}

onMounted(loadHandedCount)

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
        await recordHandoverEntry(employeeStore.fio, qrText)
        vibrate(200)
        showSuccess('Сдача записана', qrText)
        if (handedCount.value != null) handedCount.value += 1
    } catch (error) {
        vibrate([100, 50, 100])
        showError(error, 'Не удалось записать сдачу')
    } finally {
        status.value = 'scanning'
    }
}

const startScanner = async () => {
    if (!import.meta.client || !videoEl.value) return
    scanner?.destroy()
    const {default: QrScannerCtor} = await import('qr-scanner')
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
}

onMounted(startScanner)

onBeforeUnmount(() => {
    scanner?.destroy()
    scanner = null
})
</script>

<template>
  <ErpScreen
      title="Сдача работ"
      subtitle="Считайте QR бирки для записи сдачи"
      :shift-link="{ to: '/handover-shift', label: 'Сдачи' }"
      icon="heroicons:check-badge"
  >
    <template v-if="handedCount != null" #hero>
      <div class="erp-screen__stats">
        <div class="erp-screen__stat">
          <span class="erp-screen__stat-num">{{ handedCount }}</span>
          <span class="erp-screen__stat-label">сдач за смену</span>
        </div>
      </div>
    </template>

    <div class="erp-scan-viewport">
      <video ref="videoEl" class="erp-scan-video" muted playsinline/>

      <div v-if="status === 'saving'" class="erp-scan-overlay">
        <ErpEmptyState loading/>
        <span>Записываем…</span>
      </div>

      <div v-if="status === 'unsupported'" class="erp-scan-overlay">
        <p>Камера не найдена на этом устройстве</p>
      </div>

      <div v-if="status === 'denied'" class="erp-scan-overlay">
        <p>Разрешите камеру для erp-mt.online в Яндекс Браузере</p>
        <UiButton variant="outline" @click="startScanner">Повторить</UiButton>
      </div>
    </div>

    <p class="erp-scan-hint">Наведите камеру на QR-код бирки</p>
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
</style>
