<script setup lang="ts">
definePageMeta({layout: 'crm'})
useSeoMeta({title: 'Согласования | CRM'})
</script>

<template>
  <CrmScreen title="Согласования" icon="heroicons:check-circle">
    <div class="wip">
      <Icon name="heroicons:check-circle" size="48" class="wip__icon"/>
      <p class="wip__text">Раздел находится в разработке</p>
    </div>
  </CrmScreen>
</template>

<style scoped lang="sass">
.wip
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-4)
  padding: var(--spacing-12) var(--spacing-4)
  text-align: center

.wip__icon
  color: var(--color-text-muted)
  opacity: 0.4

.wip__text
  margin: 0
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
</style>
