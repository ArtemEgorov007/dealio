<script setup lang="ts"></script>

<template>
  <div class="card">
    <slot/>
  </div>
</template>

<style scoped lang="sass">
.card
  display: block
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-lg)
  box-shadow: var(--shadow-sm)
  background-color: var(--color-card-bg)
  overflow: hidden
  opacity: 0
  animation: card-reveal 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards
  transition: box-shadow var(--transition-normal) ease, transform var(--transition-normal) ease, border-color var(--transition-normal) ease

  &:hover
    box-shadow: var(--shadow-card-hover)
    transform: translateY(-2px)
    border-color: var(--color-border-hover)

  &[draggable="true"]:active
    cursor: grabbing

@keyframes card-reveal
  from
    opacity: 0
    transform: translateY(12px)
  to
    opacity: 1
    transform: translateY(0)
</style>
