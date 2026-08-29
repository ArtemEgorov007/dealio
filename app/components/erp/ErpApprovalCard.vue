<script setup lang="ts">
import type {ErpApproval} from '~/utils/erp-api'

const props = defineProps<{
  approval: ErpApproval
  pending: boolean
  finalStatus: 'approved' | 'rejected' | 'already_processed' | null
}>()

const emit = defineEmits<{
  open: []
  'request-decision': [action: 'approve' | 'reject']
}>()

const SWIPE_THRESHOLD = 72
const pointerStart = ref<{x: number; y: number} | null>(null)
const swipeIntent = ref<'none' | 'horizontal' | 'vertical'>('none')
const suppressNextOpen = ref(false)
let suppressNextOpenTimer: ReturnType<typeof setTimeout> | null = null

const money = (amount: number) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
}).format(amount)

const statusLabel = computed(() => {
  if (props.finalStatus === 'approved' || props.finalStatus === 'already_processed') return 'Согласован'
  if (props.finalStatus === 'rejected') return 'Отклонён'
  return ''
})

const isFinal = computed(() => props.finalStatus !== null)
const isDisabled = computed(() => props.pending || isFinal.value)

const suppressOpenForCurrentGesture = () => {
  suppressNextOpen.value = true
  if (suppressNextOpenTimer) clearTimeout(suppressNextOpenTimer)
  suppressNextOpenTimer = setTimeout(() => {
    suppressNextOpen.value = false
    suppressNextOpenTimer = null
  }, 0)
}

const startSwipe = (event: PointerEvent) => {
  if (isDisabled.value) return
  pointerStart.value = {x: event.clientX, y: event.clientY}
  swipeIntent.value = 'none'
}

const finishSwipe = (event: PointerEvent) => {
  if (!pointerStart.value || isDisabled.value) {
    pointerStart.value = null
    return
  }

  const deltaX = event.clientX - pointerStart.value.x
  const deltaY = event.clientY - pointerStart.value.y
  pointerStart.value = null

  if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
    return
  }

  suppressOpenForCurrentGesture()
  emit('request-decision', deltaX > 0 ? 'approve' : 'reject')
}

const onOpen = (event?: MouseEvent) => {
  if (isDisabled.value) return
  if (event && event.target instanceof Element && event.target.closest('.erp-approval-card__actions')) return
  if (suppressNextOpen.value) {
    suppressNextOpen.value = false
    if (suppressNextOpenTimer) clearTimeout(suppressNextOpenTimer)
    suppressNextOpenTimer = null
    return
  }
  emit('open')
}

const requestDecision = (action: 'approve' | 'reject') => {
  if (isDisabled.value) return
  emit('request-decision', action)
}
</script>

<template>
  <article
      class="erp-approval-card"
      :class="{
        'erp-approval-card--approved': finalStatus === 'approved' || finalStatus === 'already_processed',
        'erp-approval-card--rejected': finalStatus === 'rejected',
        'erp-approval-card--pending': pending,
      }"
      @pointerdown="startSwipe"
      @pointerup="finishSwipe"
      @click="onOpen"
  >
    <p class="erp-approval-card__label">Площадка</p>
    <p class="erp-approval-card__site">{{ approval.site }}</p>
    <p class="erp-approval-card__meta">{{ approval.departmentType }}</p>
    <strong class="erp-approval-card__invoice">{{ approval.invoice }}</strong>
    <output class="erp-approval-card__amount">{{ money(approval.amount) }}</output>

    <p v-if="statusLabel" class="erp-approval-card__status">{{ statusLabel }}</p>

    <div
        v-if="!isFinal"
        class="erp-approval-card__actions"
        @click.stop
        @pointerdown.stop
        @pointerup.stop
    >
      <UiButton
          variant="outline"
          :disabled="isDisabled"
          @pointerdown.stop
          @pointerup.stop
          @click.stop="requestDecision('reject')"
      >
        Отклонить
      </UiButton>
      <UiButton
          :disabled="isDisabled"
          @pointerdown.stop
          @pointerup.stop
          @click.stop="requestDecision('approve')"
      >
        Согласовать
      </UiButton>
    </div>
  </article>
</template>

<style scoped lang="sass">
.erp-approval-card
  display: grid
  gap: 6px
  padding: 16px
  border-radius: 16px
  border: 0.5px solid rgba(60, 60, 67, 0.18)
  background: #fff
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06)
  touch-action: pan-y

  &--approved
    border-color: rgba(47, 180, 99, 0.35)
    background: rgba(47, 180, 99, 0.08)

  &--rejected
    opacity: 0.72
    background: rgba(60, 60, 67, 0.06)

  &--pending
    opacity: 0.72
    pointer-events: none

.erp-approval-card__label
  margin: 0
  font-size: 12px
  color: var(--color-text-secondary)
  text-transform: uppercase
  letter-spacing: 0.04em

.erp-approval-card__site
  margin: 0
  font-size: 17px
  font-weight: 600
  line-height: 1.25

.erp-approval-card__meta
  margin: 0
  font-size: 14px
  color: var(--color-text-secondary)

.erp-approval-card__invoice
  margin: 4px 0 0
  font-size: 15px
  line-height: 1.35

.erp-approval-card__amount
  margin: 0
  font-size: 18px
  font-weight: 700
  color: var(--color-primary)

.erp-approval-card__status
  margin: 4px 0 0
  font-size: 14px
  font-weight: 600

.erp-approval-card__actions
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 10px
  margin-top: 8px
</style>
