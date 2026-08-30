<script setup lang="ts">
import type QrScanner from 'qr-scanner'
import {useErpSessionStore} from '~~/store/erp-session.store'
import {useHaptics} from '~/composables/useHaptics'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Промеры — считывание | ERP'})

const sessionStore = useErpSessionStore()
const router = useRouter()
const {vibrate} = useHaptics()

type Status = 'starting' | 'scanning' | 'unsupported' | 'denied'

const status = ref<Status>('starting')
const videoEl = ref<HTMLVideoElement | null>(null)

let scanner: QrScanner | null = null
let lastCode = ''
let lastScannedAt = 0
const DEDUPE_WINDOW_MS = 4000

const onDecode = (qrText: string) => {
    if (!qrText) return

    const now = Date.now()
    if (qrText === lastCode && now - lastScannedAt < DEDUPE_WINDOW_MS) return

    lastCode = qrText
    lastScannedAt = now

    vibrate(15)
    sessionStore.setMeasurementBadge(qrText)
    router.push('/measurement')
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
      title="Промеры"
      subtitle="Считайте QR бирки для ввода промеров"
      icon="heroicons:beaker"
  >
    <div class="erp-scan-viewport">
      <video ref="videoEl" class="erp-scan-video" muted playsinline/>

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
