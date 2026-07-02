<script setup lang="ts">
defineProps<{
  icon: string
  title?: string
  description?: string
}>()
</script>

<template>
  <CrmGroupedList>
    <div class="crm-placeholder">
      <Icon :name="icon" size="40" class="crm-placeholder__icon"/>
      <p class="crm-placeholder__title">{{ title ?? 'Раздел в разработке' }}</p>
      <p v-if="description" class="crm-placeholder__text">{{ description }}</p>
    </div>
  </CrmGroupedList>
</template>

<style scoped lang="sass">
.crm-placeholder
  display: flex
  flex-direction: column
  align-items: center
  gap: 8px
  padding: 36px 20px
  text-align: center

.crm-placeholder__icon
  color: rgba(60, 60, 67, 0.30)

.crm-placeholder__title
  margin: 0
  font-size: 17px
  font-weight: 600
  color: var(--color-text)

.crm-placeholder__text
  margin: 0
  font-size: 15px
  line-height: 1.4
  color: var(--color-text-secondary)
  max-width: 28ch
</style>
