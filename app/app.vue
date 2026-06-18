<script setup lang="ts">
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right', duration: 3500 }">
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
  </UApp>
</template>

<style lang="sass">
html, body
  height: 100%
  margin: 0
  padding: 0
  font-family: var(--font-family-base)
  background-color: var(--color-bg)
  color: var(--color-text)
  font-size: var(--font-size-base)
  line-height: var(--line-height-normal)
  -webkit-font-smoothing: antialiased
  -moz-osx-font-smoothing: grayscale

h1, h2, h3, h4, h5, h6
  color: var(--color-text)
  font-weight: var(--font-weight-semibold)
  line-height: var(--line-height-tight)
  margin: 0 0 var(--spacing-2) 0

h1
  font-size: var(--font-size-4xl)

h2
  font-size: var(--font-size-3xl)

h3
  font-size: var(--font-size-2xl)

h4
  font-size: var(--font-size-xl)

h5
  font-size: var(--font-size-lg)

h6
  font-size: var(--font-size-base)

p
  margin: 0 0 var(--spacing-4) 0
  color: var(--color-text)
  line-height: var(--line-height-relaxed)

a
  color: var(--color-primary)
  text-decoration: none
  transition: color var(--transition-normal) ease

  &:hover
    color: var(--color-primary-hover)
    text-decoration: underline

@media (max-width: 768px)
  h1
    font-size: var(--font-size-3xl)

  h2
    font-size: var(--font-size-2xl)

  h3
    font-size: var(--font-size-xl)
</style>
