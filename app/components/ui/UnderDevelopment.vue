<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: 'Этот раздел находится в активной разработке и скоро будет доступен'
})
</script>

<template>
  <div class="ud-wrapper">
    <div class="ud-icon-wrap">
      <Icon name="heroicons:wrench-screwdriver" class="ud-icon"/>
    </div>

    <h2 class="ud-title">{{ title }}</h2>
    <p class="ud-description">{{ description }}</p>
  </div>
</template>

<style scoped lang="sass">
.ud-wrapper
  flex: 1
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-4)
  min-height: 0
  width: 100%
  padding: var(--spacing-8)
  text-align: center
  background-color: var(--color-bg)

.ud-icon-wrap
  display: flex
  align-items: center
  justify-content: center
  width: 48px
  height: 48px
  border-radius: var(--radius-md)
  background-color: var(--color-bg-secondary)
  border: var(--border-width) solid var(--color-border)
  color: var(--color-text-muted)

.ud-icon
  width: 22px
  height: 22px

.ud-title
  font-size: var(--font-size-lg)
  font-weight: 600
  color: var(--color-text)
  margin: 0

.ud-description
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  margin: 0
  max-width: 36ch
</style>
