<script setup lang="ts">
useSeoMeta({ title: 'Помощь | Dealio' })
</script>

<template>
  <div class="page-wrapper">
    <UiUnderDevelopment
      title="Раздел в разработке"
      description="Гайды по доске, drag-and-drop и категориям — скоро"
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
