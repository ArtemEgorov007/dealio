<script setup lang="ts">
defineProps<{
  icon: string
  title?: string
  description?: string
}>()
</script>

<template>
  <ErpGroupedList>
    <div class="erp-placeholder">
      <Icon :name="icon" size="40" class="erp-placeholder__icon"/>
      <p class="erp-placeholder__title">{{ title ?? 'Раздел в разработке' }}</p>
      <p v-if="description" class="erp-placeholder__text">{{ description }}</p>
    </div>
  </ErpGroupedList>
</template>

<style scoped lang="sass">
.erp-placeholder
  display: flex
  flex-direction: column
  align-items: center
  gap: 8px
  padding: 36px 20px
  text-align: center

.erp-placeholder__icon
  color: rgba(60, 60, 67, 0.30)

.erp-placeholder__title
  margin: 0
  font-size: 17px
  font-weight: 600
  color: var(--color-text)

.erp-placeholder__text
  margin: 0
  font-size: 15px
  line-height: 1.4
  color: var(--color-text-secondary)
  max-width: 28ch
</style>
