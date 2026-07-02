<script setup lang="ts">
defineProps<{
  loading?: boolean
  error?: boolean
}>()
</script>

<template>
  <div
      class="crm-empty"
      :class="{
        'crm-empty--error': error,
        'crm-empty--loading': loading,
      }"
  >
    <div v-if="loading" class="crm-empty__spinner" aria-hidden="true"/>
    <slot/>
  </div>
</template>

<style scoped lang="sass">
.crm-empty
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

.crm-empty__spinner
  width: 28px
  height: 28px
  border: 2px solid rgba(60, 60, 67, 0.18)
  border-top-color: var(--color-primary)
  border-radius: 50%
  animation: crm-spin 0.8s linear infinite

@keyframes crm-spin
  to
    transform: rotate(360deg)
</style>
