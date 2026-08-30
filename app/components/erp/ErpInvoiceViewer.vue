<script setup lang="ts">
const props = defineProps<{
  open: boolean
  invoiceUrl: string
  invoice: string
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const safeUrl = computed(() => {
  const value = props.invoiceUrl.trim()
  if (!value) return ''
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
})

const frameBlocked = ref(false)

watch(() => props.open, (value) => {
  if (value) frameBlocked.value = false
})

const onFrameError = () => {
  frameBlocked.value = true
}

const dismiss = () => emit('dismiss')
</script>

<template>
  <ErpActionSheet
      :open="open"
      :busy="false"
      aria-label="Просмотр счёта"
      @dismiss="dismiss"
  >
    <template #label>{{ invoice || 'Счёт' }}</template>
    <template #content>
      <div class="erp-invoice-viewer">
        <p v-if="!safeUrl" class="erp-invoice-viewer__empty">
          Ссылка на счёт недоступна или указана некорректно.
        </p>
        <template v-else>
          <iframe
              v-if="!frameBlocked"
              class="erp-invoice-viewer__frame"
              :src="safeUrl"
              title="Просмотр счёта"
              @error="onFrameError"
          />
          <p v-else class="erp-invoice-viewer__empty">
            Браузер не показывает счёт во встроенном окне.
          </p>
          <a
              class="erp-invoice-viewer__link"
              :href="safeUrl"
              target="_blank"
              rel="noopener noreferrer"
          >
            Открыть счёт
          </a>
        </template>
      </div>
    </template>
    <template #actions>
      <UiButton block variant="outline" @click="dismiss">Закрыть</UiButton>
    </template>
  </ErpActionSheet>
</template>

<style scoped lang="sass">
.erp-invoice-viewer
  display: grid
  gap: 12px

.erp-invoice-viewer__frame
  width: 100%
  min-height: 52dvh
  border: 0.5px solid rgba(60, 60, 67, 0.18)
  border-radius: 12px
  background: #fff

.erp-invoice-viewer__empty
  margin: 0
  font-size: 14px
  line-height: 1.45
  color: var(--color-text-secondary)

.erp-invoice-viewer__link
  display: flex
  align-items: center
  justify-content: center
  width: 100%
  min-height: 44px
  border-radius: var(--radius-md)
  border: var(--border-width) solid var(--color-button-outline-border)
  color: var(--color-button-outline-text)
  text-decoration: none
  font-weight: 600
</style>
