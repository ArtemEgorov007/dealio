<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: boolean
}>()
</script>

<template>
  <div
      class="erp-empty"
      :class="{
        'erp-empty--error': error,
        'erp-empty--loading': loading,
      }"
  >
    <div v-if="loading" class="erp-empty__spinner" aria-hidden="true"/>
    <slot/>
  </div>
</template>

<style scoped lang="sass">
.erp-empty
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: 12px
  padding: 40px 16px
  text-align: center
  color: var(--color-text-secondary)
  font-size: 15px
  line-height: 1.4

  &--error
    color: var(--color-danger)

.erp-empty__spinner
  width: 28px
  height: 28px
  border: 2px solid rgba(60, 60, 67, 0.18)
  border-top-color: var(--color-primary)
  border-radius: 50%
  animation: erp-spin 0.8s linear infinite

@keyframes erp-spin
  to
    transform: rotate(360deg)
</style>
