<script setup lang="ts">
const props = defineProps<{
  open: boolean
  busy: boolean
  ariaLabel: string
}>()

const emit = defineEmits<{
  dismiss: []
}>()

watch(() => props.open, (value) => {
    if (import.meta.client) {
        document.body.style.overflow = value ? 'hidden' : ''
    }
}, {immediate: true})

onBeforeUnmount(() => {
    if (import.meta.client) document.body.style.overflow = ''
})

const dismiss = () => {
    if (props.busy) return
    emit('dismiss')
}

const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismiss()
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
    if (props.busy) return
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
        dismiss()
    }

    dragY.value = 0
}
</script>

<template>
  <Transition name="erp-sheet">
    <div v-if="open" class="erp-sheet-root">
      <div class="erp-sheet-backdrop" aria-hidden="true" @click="dismiss"/>

      <div
          class="erp-sheet-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          :style="panelStyle"
      >
        <div class="erp-sheet-grip" @pointerdown="onDragStart">
          <span class="erp-sheet-handle"/>
        </div>

        <p v-if="$slots.label" class="erp-sheet-label"><slot name="label"/></p>

        <article v-if="$slots.content" class="erp-sheet-card">
          <p class="erp-sheet-content"><slot name="content"/></p>
        </article>

        <p v-if="$slots.meta" class="erp-sheet-meta"><slot name="meta"/></p>
        <Transition name="erp-sheet-error">
          <p v-if="$slots.error" class="erp-sheet-error"><slot name="error"/></p>
        </Transition>

        <div v-if="$slots.form" class="erp-sheet-form">
          <slot name="form"/>
        </div>

        <div v-if="$slots.actions" class="erp-sheet-actions">
          <slot name="actions"/>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="sass">
.erp-sheet-root
  position: fixed
  inset: 0
  z-index: var(--z-index-modal)
  display: flex
  align-items: flex-end
  justify-content: center

.erp-sheet-backdrop
  position: absolute
  inset: 0
  background-color: rgba(0, 0, 0, 0.35)

.erp-sheet-panel
  position: relative
  width: 100%
  max-width: 480px
  display: flex
  flex-direction: column
  align-items: stretch
  gap: 8px
  padding: 0 16px calc(16px + env(safe-area-inset-bottom))
  background-color: #F2F2F7
  border: none
  border-bottom: none
  border-radius: 18px 18px 0 0
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12)
  will-change: transform

.erp-sheet-grip
  display: flex
  justify-content: center
  width: 100%
  padding: var(--spacing-3) 0
  touch-action: none
  cursor: grab

.erp-sheet-handle
  width: 36px
  height: 4px
  border-radius: var(--radius-full)
  background-color: var(--color-border)

.erp-sheet-label
  margin: 0
  padding: 0 4px
  font-size: 13px
  font-weight: 400
  color: var(--color-text-secondary)

.erp-sheet-card
  width: 100%
  box-sizing: border-box
  padding: 16px
  border: none
  border-radius: 13px
  background-color: var(--color-card-bg)
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04)

.erp-sheet-content
  margin: 0
  font-size: 17px
  font-weight: 600
  line-height: 1.35
  color: var(--color-text)
  text-align: center
  white-space: pre-line
  overflow-wrap: anywhere

.erp-sheet-meta
  margin: 0
  padding: 0 4px
  font-size: 13px
  text-align: center
  color: var(--color-text-secondary)

.erp-sheet-error
  margin: 0
  padding: 12px 14px
  width: 100%
  box-sizing: border-box
  border-radius: 13px
  background-color: rgba(255, 59, 48, 0.10)
  color: #FF3B30
  font-size: 15px
  line-height: 1.4

.erp-sheet-error-enter-active,
.erp-sheet-error-leave-active
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease

.erp-sheet-error-enter-from,
.erp-sheet-error-leave-to
  transform: translateY(-6px)
  opacity: 0

.erp-sheet-form
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
  width: 100%

.erp-sheet-actions
  display: flex
  flex-direction: column
  gap: 8px
  width: 100%
  margin-top: 4px

// Своя, более заметная длительность — только для этой шторки (не трогаем
// общий --dealio-motion-duration, которым делятся тосты и другие панели).
.erp-sheet-enter-active,
.erp-sheet-leave-active
  .erp-sheet-backdrop
    transition: opacity 0.36s var(--dealio-motion-ease)

  .erp-sheet-panel
    transition: transform 0.36s var(--dealio-motion-ease)

.erp-sheet-enter-from,
.erp-sheet-leave-to
  .erp-sheet-backdrop
    opacity: 0

  .erp-sheet-panel
    transform: translateY(100%)
</style>
