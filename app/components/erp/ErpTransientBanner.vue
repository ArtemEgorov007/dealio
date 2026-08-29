<script setup lang="ts">
const props = withDefaults(defineProps<{
  message: string
  icon?: string
  durationMs?: number
}>(), {
  icon: 'heroicons:bell',
  durationMs: 4000,
})

const emit = defineEmits<{
  dismissed: []
}>()

const visible = ref(false)
const leaving = ref(false)
let hideTimer: ReturnType<typeof window.setTimeout> | null = null
let removeTimer: ReturnType<typeof window.setTimeout> | null = null

const hasMessage = computed(() => props.message.trim().length > 0)

const clearTimers = () => {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
  if (removeTimer !== null) {
    window.clearTimeout(removeTimer)
    removeTimer = null
  }
}

const dismiss = () => {
  if (!visible.value || leaving.value) return
  leaving.value = true
  removeTimer = window.setTimeout(() => {
    visible.value = false
    leaving.value = false
    emit('dismissed')
  }, 280)
}

const show = () => {
  if (!hasMessage.value) {
    visible.value = false
    return
  }
  clearTimers()
  leaving.value = false
  visible.value = true
  hideTimer = window.setTimeout(dismiss, props.durationMs)
}

watch(() => props.message, (message) => {
  if (message.trim()) {
    show()
    return
  }
  clearTimers()
  visible.value = false
  leaving.value = false
}, {immediate: true})

onBeforeUnmount(clearTimers)

defineExpose({show, dismiss})
</script>

<template>
  <Teleport to="body">
    <Transition name="erp-transient-banner">
      <div
          v-if="visible && hasMessage"
          class="erp-transient-banner"
          :class="{'erp-transient-banner--leaving': leaving}"
          role="status"
          aria-live="polite"
          @click="dismiss"
      >
        <span class="erp-transient-banner__icon" aria-hidden="true">
          <Icon :name="icon" size="15"/>
        </span>
        <p class="erp-transient-banner__text">{{ message }}</p>
      </div>
    </Transition>
  </Teleport>
</template>
