<script setup lang="ts">
useSeoMeta({ title: 'Задачи | Dealio' })
</script>

<template>
  <div class="page-wrapper">
    <UiUnderDevelopment
      title="Список задач"
      description="Классический todo-список с дедлайнами — в разработке. Kanban-доска уже доступна"
    />
  </div>
</template>

<style scoped lang="sass">
.page-wrapper
  padding: var(--spacing-6)
  max-width: 1200px
  margin: 0 auto
</style>
