<script setup lang="ts">
import {appendBadgeJournalEntry} from '~/utils/crm-sheets'
import {formatBadgeDisplay} from '~/utils/crm-csv'
import {workshopLabel} from '~~/types/crm.types'
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {useHaptics} from '~/composables/useHaptics'

const props = defineProps<{
  badge: string | null
}>()

const emit = defineEmits<{
  issued: [skipped: boolean]
  cancel: []
}>()

const employeeStore = useCrmEmployeeStore()
const {vibrate} = useHaptics()

type Phase = 'confirm' | 'saving' | 'error'

const phase = ref<Phase>('confirm')
const error = ref('')

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

watch(() => props.badge, (value) => {
    if (value) {
        phase.value = 'confirm'
        error.value = ''
    }

    if (import.meta.client) {
        document.body.style.overflow = value ? 'hidden' : ''
    }
}, {immediate: true})

onBeforeUnmount(() => {
    if (import.meta.client) document.body.style.overflow = ''
})

const confirm = async () => {
    if (!props.badge || !employeeStore.workshopId) return

    // Вибрировать нужно синхронно в обработчике тапа — после await на
    // сетевой запрос браузер уже не считает это ответом на жест пользователя
    // и тихо игнорирует вызов (заметнее всего в Chrome на Android).
    vibrate(15)

    phase.value = 'saving'
    error.value = ''

    try {
        const result = await appendBadgeJournalEntry({
            workshopId: employeeStore.workshopId,
            fio: employeeStore.fio,
            badgeContent: props.badge,
        })

        vibrate(200)
        emit('issued', result === 'skipped')
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Не удалось записать в журнал'
        phase.value = 'error'
        vibrate([100, 50, 100])
    }
}

const cancel = () => {
    if (phase.value === 'saving') return
    emit('cancel')
}

const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cancel()
}

onMounted(() => document.addEventListener('keydown', onEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', onEscape))

// Свайп вниз по ручке шторки — закрывает попап, как системные шторки
// в iOS/Android. Ниже порога — отпружинивает обратно.
const DISMISS_THRESHOLD = 90

const isDragging = ref(false)
const dragY = ref(0)
let dragStartY = 0

const panelStyle = computed(() => isDragging.value
    ? {transform: `translateY(${dragY.value}px)`, transition: 'none'}
    : undefined,
)

const onDragStart = (event: PointerEvent) => {
    if (phase.value === 'saving') return
    isDragging.value = true
    dragStartY = event.clientY
    dragY.value = 0
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
}

const onDragMove = (event: PointerEvent) => {
    dragY.value = Math.max(0, event.clientY - dragStartY)
}

const onDragEnd = () => {
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    isDragging.value = false

    if (dragY.value > DISMISS_THRESHOLD) {
        cancel()
    }

    dragY.value = 0
}
</script>

<template>
  <Transition name="crm-sheet">
    <div v-if="badge" class="crm-sheet-root">
      <div class="crm-sheet-backdrop" aria-hidden="true" @click="cancel"/>

      <div
          class="crm-sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Подтверждение выдачи бирки"
          :style="panelStyle"
      >
        <div class="crm-sheet-grip" @pointerdown="onDragStart">
          <span class="crm-sheet-handle"/>
        </div>

        <p class="crm-sheet-label">{{ phase === 'error' ? 'Ошибка записи' : 'Выдать бирку' }}</p>

        <article class="crm-sheet-card">
          <p class="crm-sheet-content">{{ formatBadgeDisplay(badge) }}</p>
        </article>

        <p class="crm-sheet-meta">{{ employeeStore.fio }} · {{ workshopTitle }}</p>
        <p v-if="phase === 'error'" class="crm-sheet-error">{{ error }}</p>

        <div class="crm-sheet-actions">
          <UiButton block :loading="phase === 'saving'" @click="confirm">
            {{ phase === 'error' ? 'Повторить' : 'Подтвердить выдачу' }}
          </UiButton>
          <UiButton block variant="outline" :disabled="phase === 'saving'" @click="cancel">
            {{ phase === 'error' ? 'Отмена' : 'Это не та бирка' }}
          </UiButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="sass">
.crm-sheet-root
  position: fixed
  inset: 0
  z-index: var(--z-index-modal)
  display: flex
  align-items: flex-end
  justify-content: center

.crm-sheet-backdrop
  position: absolute
  inset: 0
  background-color: rgba(1, 35, 66, 0.32)

.crm-sheet-panel
  position: relative
  width: 100%
  max-width: 480px
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--spacing-2)
  padding: 0 var(--spacing-5) calc(var(--spacing-5) + env(safe-area-inset-bottom))
  background-color: var(--color-bg)
  border: var(--border-width) solid var(--color-border)
  border-bottom: none
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0
  box-shadow: var(--shadow-xl)
  will-change: transform

.crm-sheet-grip
  display: flex
  justify-content: center
  width: 100%
  padding: var(--spacing-3) 0
  touch-action: none
  cursor: grab

.crm-sheet-handle
  width: 36px
  height: 4px
  border-radius: var(--radius-full)
  background-color: var(--color-border)

.crm-sheet-label
  align-self: flex-start
  margin: 0
  font-size: var(--font-size-xs)
  font-weight: 700
  text-transform: uppercase
  letter-spacing: 0.4px
  color: var(--color-text-muted)

.crm-sheet-card
  width: 100%
  box-sizing: border-box
  padding: var(--spacing-4)
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-md)
  background-color: var(--color-card-bg)

.crm-sheet-content
  margin: 0
  font-size: var(--font-size-sm)
  font-weight: 500
  line-height: 1.4
  color: var(--color-text)
  white-space: pre-line
  overflow-wrap: anywhere

.crm-sheet-meta
  align-self: flex-start
  margin: 0 0 var(--spacing-2)
  font-size: var(--font-size-sm)
  color: var(--color-text-secondary)

.crm-sheet-error
  align-self: flex-start
  margin: 0 0 var(--spacing-2)
  padding: 10px 12px
  width: 100%
  box-sizing: border-box
  border-radius: var(--radius-md)
  background-color: rgba(239, 68, 68, 0.1)
  color: var(--color-danger)
  font-size: var(--font-size-sm)

.crm-sheet-actions
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
  width: 100%
  margin-top: var(--spacing-2)

.crm-sheet-enter-active,
.crm-sheet-leave-active
  .crm-sheet-backdrop
    transition: opacity var(--dealio-motion-duration) var(--dealio-motion-ease)

  .crm-sheet-panel
    transition: transform var(--dealio-motion-duration) var(--dealio-motion-ease)

.crm-sheet-enter-from,
.crm-sheet-leave-to
  .crm-sheet-backdrop
    opacity: 0

  .crm-sheet-panel
    transform: translateY(100%)
</style>
