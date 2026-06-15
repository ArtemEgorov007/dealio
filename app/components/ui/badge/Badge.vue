<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md'
})
</script>

<template>
  <span
      class="ui-badge"
      :class="[
      `ui-badge--${variant}`,
      `ui-badge--${size}`
    ]"
  >
    <slot/>
  </span>
</template>

<style scoped lang="sass">
.ui-badge
  display: inline-flex
  align-items: center
  justify-content: center
  border-radius: var(--radius-full)
  font-weight: 600
  white-space: nowrap
  letter-spacing: 0.2px
  font-size: var(--font-size-xs)

  &--sm
    padding: 2px var(--spacing-2)
    font-size: 10px

  &--md
    padding: 3px 8px
    font-size: var(--font-size-xs)

  &--lg
    padding: var(--spacing-1) var(--spacing-3)
    font-size: var(--font-size-sm)

  &--primary
    background-color: var(--color-primary-light)
    color: var(--color-primary)

  &--secondary
    background-color: rgba(100, 116, 139, 0.08)
    color: var(--color-secondary)

  &--success
    background-color: rgba(16, 185, 129, 0.1)
    color: var(--color-success)

  &--warning
    background-color: rgba(245, 158, 11, 0.1)
    color: var(--color-warning)

  &--danger
    background-color: rgba(239, 68, 68, 0.1)
    color: var(--color-danger)

  &--info
    background-color: rgba(14, 165, 233, 0.1)
    color: var(--color-info)
</style>
