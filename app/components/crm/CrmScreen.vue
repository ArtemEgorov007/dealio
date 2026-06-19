<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <section class="crm-screen">
    <header class="crm-screen__head">
      <h1 class="crm-screen__title">{{ title }}</h1>
      <p v-if="subtitle" class="crm-screen__subtitle">{{ subtitle }}</p>
    </header>

    <div class="crm-screen__body">
      <slot/>
    </div>
  </section>
</template>

<style scoped lang="sass">
.crm-screen
  width: 100%
  max-width: 480px
  margin: 0 auto
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-8)
  min-height: 100dvh
  display: flex
  flex-direction: column
  box-sizing: border-box

  @media (max-width: 768px)
    padding: var(--spacing-5) var(--spacing-4) calc(var(--spacing-8) + env(safe-area-inset-bottom))

.crm-screen__head
  margin-bottom: var(--spacing-6)

.crm-screen__title
  font-size: var(--font-size-3xl)
  font-weight: 800
  letter-spacing: -0.4px
  line-height: 1.15
  margin-bottom: var(--spacing-2)

.crm-screen__subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  line-height: var(--line-height-relaxed)

.crm-screen__body
  flex: 1
  display: flex
  flex-direction: column
  gap: var(--spacing-4)
</style>
