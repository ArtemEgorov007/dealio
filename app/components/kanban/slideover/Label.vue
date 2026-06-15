<script setup lang="ts">
import {defineProps} from 'vue'

defineProps({
  labelText: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="slideover-label">
    <label
        v-if="labelText"
        class="slideover-label__text"
    >
      {{ labelText }}
    </label>

    <div class="slideover-label__value">
      <slot/>
    </div>
  </div>
</template>

<style scoped lang="sass">
.slideover-label
  margin-bottom: var(--spacing-3)

  &__text
    display: block
    font-size: var(--font-size-xs)
    font-weight: 700
    color: var(--color-text-muted)
    text-transform: uppercase
    letter-spacing: 0.4px
    margin-bottom: 5px

  &__value
    font-size: var(--font-size-sm)
    color: var(--color-text)
    font-weight: 500
    line-height: var(--line-height-normal)

  &:last-child
    margin-bottom: 0
</style>
