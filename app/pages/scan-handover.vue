<script setup lang="ts">
import type QrScanner from 'qr-scanner'
import {recordHandoverEntry} from '~/utils/erp-sheets'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useAppToast} from '~/composables/useAppToast'
import {useHaptics} from '~/composables/useHaptics'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Сдача работ | ERP'})

const employeeStore = useErpEmployeeStore()
const {showSuccess, showError} = useAppToast()
const {vibrate} = useHaptics()

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
    } catch (error) {
        vibrate([100, 50, 100])
        showError(error, 'Не удалось записать сдачу')
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
      title="Сдача работ"
      subtitle="Считайте QR бирки для записи сдачи"
      :shift-link="{ to: '/handover-shift', label: 'Сдачи' }"
      icon="heroicons:check-badge"
  >
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
        <p>Нет доступа к камере — разрешите доступ в настройках браузера и обновите страницу</p>
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
