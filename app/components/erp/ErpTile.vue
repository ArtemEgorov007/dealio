<script setup lang="ts">
defineProps<{
  to: string
  icon: string
  label: string
  caption?: string
  count?: number | null
  tone?: string
}>()
</script>

<template>
  <NuxtLink :to="to" class="erp-tile">
    <span
        class="erp-tile__ic"
        :style="tone ? { color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, #fff)` } : undefined"
    >
      <Icon :name="icon" size="20"/>
    </span>
    <span v-if="count != null" class="erp-tile__count" :style="tone ? { backgroundColor: tone } : undefined">
      {{ count }}
    </span>
    <span class="erp-tile__label">{{ label }}</span>
    <span v-if="caption" class="erp-tile__caption">{{ caption }}</span>
  </NuxtLink>
</template>

<style scoped lang="sass">
.erp-tile
  position: relative
  display: flex
  flex-direction: column
  gap: 9px
  min-height: 96px
  padding: 13px 12px 12px
  border-radius: 16px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-tile)
  text-decoration: none
  color: var(--color-text)
  transition: transform 0.15s ease, box-shadow 0.15s ease

  &:active
    transform: scale(0.97)

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

.erp-tile__ic
  display: flex
  align-items: center
  justify-content: center
  width: 36px
  height: 36px
  border-radius: 11px
  color: var(--color-primary)
  background-color: var(--color-primary-light)

.erp-tile__count
  position: absolute
  top: 12px
  right: 12px
  min-width: 21px
  height: 21px
  padding: 0 6px
  display: flex
  align-items: center
  justify-content: center
  border-radius: var(--radius-full)
  background-color: var(--color-primary)
  color: #fff
  font-size: 12px
  font-weight: 700
  font-variant-numeric: tabular-nums

.erp-tile__label
  font-size: 14px
  font-weight: 700
  letter-spacing: -0.2px

.erp-tile__caption
  margin-top: -5px
  font-size: 11.5px
  color: var(--color-text-secondary)
</style>
