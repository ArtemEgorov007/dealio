<script setup lang="ts"></script>

<template>
  <div class="card-footer">
    <slot/>
  </div>
</template>

<style lang="sass" scoped>
.card-footer
  padding: var(--spacing-3) var(--spacing-5)
  border-top: var(--border-width) solid var(--color-card-border)
  background-color: var(--color-card-bg)
  color: var(--color-text-secondary)
  font-size: var(--font-size-sm)
</style>
