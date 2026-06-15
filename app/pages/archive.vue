<script setup lang="ts">
useSeoMeta({ title: 'Архив | Dealio' })
</script>

<template>
  <div class="page-wrapper">
    <UiUnderDevelopment
      title="Архив карточек"
      description="Завершённые и отложенные карточки будут храниться здесь — пока переносите их в колонку «Готово»"
    />
  </div>
</template>

<style scoped lang="sass">
.page-wrapper
  padding: var(--spacing-6)
  max-width: 1200px
  margin: 0 auto
</style>
