<script setup lang="ts">
// Точка входа ERP — редирект выполняет middleware erp-flow.global.ts.
// Layout выключен намеренно: страница живёт лишь мгновение до редиректа
// и своего оформления не имеет.
definePageMeta({layout: false})
</script>

<template>
  <div class="erp-entry"/>
</template>

<style scoped lang="sass">
.erp-entry
  min-height: 100dvh
  background-color: var(--color-bg)
</style>
