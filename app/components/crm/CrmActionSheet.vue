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
  <Transition name="crm-sheet">
    <div v-if="open" class="crm-sheet-root">
      <div class="crm-sheet-backdrop" aria-hidden="true" @click="dismiss"/>

      <div
          class="crm-sheet-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          :style="panelStyle"
      >
        <div class="crm-sheet-grip" @pointerdown="onDragStart">
          <span class="crm-sheet-handle"/>
        </div>

        <p v-if="$slots.label" class="crm-sheet-label"><slot name="label"/></p>

        <article v-if="$slots.content" class="crm-sheet-card">
          <p class="crm-sheet-content"><slot name="content"/></p>
        </article>

        <p v-if="$slots.meta" class="crm-sheet-meta"><slot name="meta"/></p>
        <p v-if="$slots.error" class="crm-sheet-error"><slot name="error"/></p>

        <div v-if="$slots.actions" class="crm-sheet-actions">
          <slot name="actions"/>
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
  background-color: rgba(0, 0, 0, 0.35)

.crm-sheet-panel
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
  margin: 0
  padding: 0 4px
  font-size: 13px
  font-weight: 400
  color: var(--color-text-secondary)

.crm-sheet-card
  width: 100%
  box-sizing: border-box
  padding: 16px
  border: none
  border-radius: 13px
  background-color: var(--color-card-bg)
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04)

.crm-sheet-content
  margin: 0
  font-size: 17px
  font-weight: 600
  line-height: 1.35
  color: var(--color-text)
  text-align: center
  white-space: pre-line
  overflow-wrap: anywhere

.crm-sheet-meta
  margin: 0
  padding: 0 4px
  font-size: 13px
  text-align: center
  color: var(--color-text-secondary)

.crm-sheet-error
  margin: 0
  padding: 12px 14px
  width: 100%
  box-sizing: border-box
  border-radius: 13px
  background-color: rgba(255, 59, 48, 0.10)
  color: #FF3B30
  font-size: 15px
  line-height: 1.4

.crm-sheet-actions
  display: flex
  flex-direction: column
  gap: 8px
  width: 100%
  margin-top: 4px

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
