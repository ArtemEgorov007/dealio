<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  shiftLink?: { to: string; label: string }
  icon?: string
}>()

const logoSrc = useRuntimeConfig().app.baseURL + 'logo-mt.svg'

useSeoMeta({themeColor: '#F2F2F7'})
useHead({meta: [{name: 'color-scheme', content: 'light'}]})
</script>

<template>
  <section class="crm-screen">
    <header class="crm-screen__head">
      <div class="crm-screen__head-row">
        <div class="crm-screen__brand">
          <img :src="logoSrc" alt="Морфлот Технология" class="crm-screen__brand-mark">
        </div>
        <div class="crm-screen__head-actions">
          <NuxtLink v-if="shiftLink" :to="shiftLink.to" class="crm-screen__shift-link">
            <Icon name="heroicons:clipboard-document-list" size="16"/>
            {{ shiftLink.label }}
          </NuxtLink>
          <slot name="actions"/>
        </div>
      </div>
      <h1 class="crm-screen__title">
        <Icon v-if="icon" :name="icon" size="24" class="crm-screen__title-icon"/>
        {{ title }}
      </h1>
      <p v-if="subtitle" class="crm-screen__subtitle">{{ subtitle }}</p>
      <div v-if="$slots.search" class="crm-screen__search">
        <slot name="search"/>
      </div>
    </header>

    <div class="crm-screen__body">
      <slot/>
    </div>

    <footer v-if="$slots.footer" class="crm-screen__footer">
      <slot name="footer"/>
    </footer>
  </section>
</template>

<style scoped lang="sass">
.crm-screen
  width: 100%
  max-width: 480px
  margin: 0 auto
  padding: var(--spacing-5) var(--spacing-4) 0
  flex: 1
  min-height: 0
  display: flex
  flex-direction: column
  box-sizing: border-box

.crm-screen__head
  flex-shrink: 0
  margin-bottom: var(--spacing-5)

.crm-screen__head-row
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-5)

.crm-screen__brand
  display: flex

.crm-screen__brand-mark
  height: 24px
  width: auto
  display: block
  opacity: 0.85

.crm-screen__head-actions
  display: flex
  align-items: center
  gap: var(--spacing-2)

.crm-screen__title
  display: flex
  align-items: center
  gap: var(--spacing-2)

.crm-screen__title-icon
  flex-shrink: 0
  color: var(--color-primary)
  opacity: 0.9

.crm-screen__shift-link
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 5px
  padding: 6px 12px
  border-radius: var(--radius-full)
  background-color: var(--color-primary-light)
  color: var(--color-primary)
  font-size: var(--font-size-xs)
  font-weight: 600
  white-space: nowrap
  text-decoration: none
  border: none

.crm-screen__title
  font-size: var(--font-size-4xl)  /* 34px — iOS Large Title */
  font-weight: 700
  letter-spacing: -0.5px
  line-height: 1.1
  margin-bottom: var(--spacing-1)
  color: var(--color-text)

.crm-screen__subtitle
  font-size: var(--font-size-base)
  color: var(--color-text-secondary)
  line-height: 1.4

.crm-screen__search
  margin-top: var(--spacing-4)

.crm-screen__body
  flex: 1
  min-height: 0
  overflow-y: auto
  -webkit-overflow-scrolling: touch
  display: flex
  flex-direction: column
  align-items: stretch
  gap: var(--spacing-3)
  padding-bottom: var(--spacing-4)

  > *
    flex-shrink: 0

.crm-screen__footer
  flex-shrink: 0
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  padding: var(--spacing-3) 0 calc(var(--spacing-4) + env(safe-area-inset-bottom))
  border-top: 0.5px solid var(--color-border)
  background-color: var(--color-bg)
</style>
