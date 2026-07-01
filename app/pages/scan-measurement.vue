<script setup lang="ts">
import type QrScanner from 'qr-scanner'
import {useCrmSessionStore} from '~~/store/crm-session.store'
import {useHaptics} from '~/composables/useHaptics'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Промеры — считывание | CRM'})

const sessionStore = useCrmSessionStore()
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
  <CrmScreen
      title="Промеры"
      subtitle="Считайте QR бирки для ввода промеров"
      icon="heroicons:beaker"
  >
    <div class="scan-viewport">
      <video ref="videoEl" class="scan-video" muted playsinline/>

      <div v-if="status === 'unsupported'" class="scan-overlay scan-overlay--error">
        <p>Камера не найдена на этом устройстве</p>
      </div>

      <div v-if="status === 'denied'" class="scan-overlay scan-overlay--error">
        <p>Нет доступа к камере — разрешите доступ в настройках браузера и обновите страницу</p>
      </div>
    </div>

    <p class="scan-hint">Наведите камеру на QR-код бирки</p>
  </CrmScreen>
</template>

<style scoped lang="sass">
.scan-viewport
  position: relative
  width: 100%
  aspect-ratio: 1
  border-radius: var(--radius-lg)
  overflow: hidden
  background-color: #000

.scan-video
  width: 100%
  height: 100%
  object-fit: cover

.scan-overlay
  position: absolute
  inset: 0
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-3)
  padding: var(--spacing-4)
  text-align: center
  color: #fff
  background-color: rgba(0, 0, 0, 0.55)

  &--error
    color: #fff

.scan-hint
  margin: 0
  font-size: var(--font-size-sm)
  color: var(--color-text-secondary)
  text-align: center
</style>
