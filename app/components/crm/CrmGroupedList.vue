<template>
  <div class="crm-grouped-list" :class="{'crm-grouped-list--inset': inset}">
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
.crm-grouped-list
  display: flex
  flex-direction: column
  flex-shrink: 0
  background-color: var(--color-card-bg)
  border-radius: 13px
  overflow: hidden
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04)

  &--inset
    margin: 0
</style>
