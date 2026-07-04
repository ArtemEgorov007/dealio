<template>
  <div class="erp-grouped-list" :class="{'erp-grouped-list--inset': inset}">
    <slot/>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  inset?: boolean
}>(), {
  inset: true,
})
</script>

<style scoped lang="sass">
.erp-grouped-list
  display: flex
  flex-direction: column
  flex-shrink: 0
  background-color: var(--color-card-bg)
  border-radius: 14px
  overflow: hidden
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

  &--inset
    margin: 0
</style>
