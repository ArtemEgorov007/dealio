<script setup lang="ts">
useSeoMeta({ title: 'Идеи | Dealio' })
</script>

<template>
  <div class="page-wrapper">
    <UiUnderDevelopment
      title="Идеи скоро появятся"
      description="Здесь будет отдельный список всех идей с фильтрами — пока работайте с доской"
    />
  </div>
</template>

<style scoped lang="sass">
.page-wrapper
  padding: var(--spacing-6)
  max-width: 1200px
  margin: 0 auto

  @media (max-width: 768px)
    padding: var(--spacing-4)
</style>
