<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
  type: 'button'
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
      :type="type"
      class="ui-btn"
      :class="[
      `ui-btn--${variant}`,
      `ui-btn--${size}`,
      { 'ui-btn--block': block, 'ui-btn--loading': loading }
    ]"
      :disabled="disabled || loading"
      :aria-busy="loading"
      @click="handleClick"
  >
    <span v-if="loading" class="ui-btn__spinner"></span>
    <span class="ui-btn__content">
      <slot/>
    </span>
  </button>
</template>

<style scoped lang="sass">
.ui-btn
  position: relative
  display: inline-flex
  align-items: center
  justify-content: center
  border: var(--border-width) solid transparent
  border-radius: var(--radius-md)
  font-weight: 600
  font-family: inherit
  cursor: pointer
  transition: all var(--transition-normal) var(--transition-ease)
  white-space: nowrap
  user-select: none
  letter-spacing: -0.1px

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

  &:disabled
    cursor: not-allowed
    opacity: 0.5

  &--block
    display: flex
    width: 100%

  &--loading
    pointer-events: none

  &__spinner
    width: 0.875em
    height: 0.875em
    border: 2px solid currentColor
    border-right-color: transparent
    border-radius: 50%
    margin-right: var(--spacing-2)
    animation: spin 0.7s linear infinite
    opacity: 0.7
    flex-shrink: 0

  &__content
    display: flex
    align-items: center
    justify-content: center
    gap: var(--spacing-2)

  &--primary
    background-color: var(--color-button-primary-bg)
    color: var(--color-button-primary-text)
    border-color: var(--color-button-primary-bg)
    box-shadow: 0 1px 3px rgba(13, 148, 136, 0.25)

    &:hover:enabled
      background-color: var(--color-button-primary-bg-hover)
      border-color: var(--color-button-primary-bg-hover)
      box-shadow: 0 2px 8px rgba(13, 148, 136, 0.35)
      transform: translateY(-1px)

    &:active:enabled
      transform: translateY(0)
      box-shadow: none

  &--secondary
    background-color: var(--color-button-secondary-bg)
    color: var(--color-button-secondary-text)
    border-color: var(--color-border)

    &:hover:enabled
      background-color: var(--color-button-secondary-bg-hover)
      border-color: var(--color-border-hover)

  &--outline
    background-color: transparent
    color: var(--color-button-outline-text)
    border-color: var(--color-button-outline-border)

    &:hover:enabled
      background-color: var(--color-primary-light)

  &--ghost
    background-color: transparent
    color: var(--color-button-ghost-text)
    border-color: transparent

    &:hover:enabled
      background-color: var(--color-bg-secondary)
      color: var(--color-button-ghost-text-hover)

  &--link
    background-color: transparent
    color: var(--color-primary)
    border-color: transparent
    padding-left: 0
    padding-right: 0

    &:hover:enabled
      color: var(--color-primary-hover)
      text-decoration: underline

  &--sm
    padding: 6px var(--spacing-3)
    font-size: var(--font-size-xs)
    height: 30px

  &--md
    padding: 8px var(--spacing-4)
    font-size: var(--font-size-sm)
    height: 36px

  &--lg
    padding: 10px var(--spacing-5)
    font-size: var(--font-size-base)
    height: 44px

@keyframes spin
  to
    transform: rotate(360deg)
</style>
