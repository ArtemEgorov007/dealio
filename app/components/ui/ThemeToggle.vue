<script setup lang="ts">
import { useTheme } from '~/composables/useTheme'

const { theme, toggleTheme } = useTheme()

const toggle = () => {
  toggleTheme()
}
</script>

<template>
  <button
    class="theme-toggle"
    @click="toggle"
    :aria-label="theme === 'light' ? 'Переключить тёмную тему' : 'Переключить светлую тему'"
  >
    <Icon
      v-if="theme === 'light'"
      name="heroicons:moon"
      class="theme-icon"
    />
    <Icon
      v-else
      name="heroicons:sun"
      class="theme-icon"
    />
  </button>
</template>

<style scoped lang="sass">
.theme-toggle
  display: flex
  align-items: center
  justify-content: center
  width: 34px
  height: 34px
  border-radius: var(--radius-md)
  background-color: var(--color-button-secondary-bg)
  border: var(--border-width) solid var(--color-border)
  color: var(--color-text-secondary)
  cursor: pointer
  transition: all var(--transition-normal) ease
  flex-shrink: 0

  &:hover
    background-color: var(--color-button-secondary-bg-hover)
    border-color: var(--color-border-hover)
    color: var(--color-text)

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

.theme-icon
  width: 16px
  height: 16px
</style>
