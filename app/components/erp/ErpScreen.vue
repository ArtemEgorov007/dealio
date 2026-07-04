<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  shiftLink?: { to: string; label: string }
  icon?: string
}>()

const logoSrc = useRuntimeConfig().app.baseURL + 'logo-mt.svg'

useSeoMeta({themeColor: '#016ED7'})
useHead({meta: [{name: 'color-scheme', content: 'light'}]})
</script>

<template>
  <section class="erp-screen">
    <header class="erp-screen__head">
      <div class="erp-screen__head-inner">
        <div class="erp-screen__head-row">
          <div class="erp-screen__brand">
            <img :src="logoSrc" alt="Морфлот Технология" class="erp-screen__brand-mark">
          </div>
          <div class="erp-screen__head-actions">
            <NuxtLink v-if="shiftLink" :to="shiftLink.to" class="erp-screen__shift-link">
              <Icon name="heroicons:clipboard-document-list" size="16"/>
              {{ shiftLink.label }}
            </NuxtLink>
            <slot name="actions"/>
          </div>
        </div>
        <h1 class="erp-screen__title">
          <Icon v-if="icon" :name="icon" size="22" class="erp-screen__title-icon"/>
          {{ title }}
        </h1>
        <p v-if="subtitle" class="erp-screen__subtitle">{{ subtitle }}</p>
        <div v-if="$slots.hero" class="erp-screen__hero">
          <slot name="hero"/>
        </div>
        <div v-if="$slots.search" class="erp-screen__search">
          <slot name="search"/>
        </div>
      </div>
    </header>

    <div class="erp-screen__body">
      <slot/>
    </div>

    <footer v-if="$slots.footer" class="erp-screen__footer">
      <slot name="footer"/>
    </footer>
  </section>
</template>

<style scoped lang="sass">
.erp-screen
  width: 100%
  max-width: 480px
  margin: 0 auto
  flex: 1
  min-height: 0
  display: flex
  flex-direction: column
  box-sizing: border-box

.erp-screen__head
  flex-shrink: 0
  background: var(--erp-grad-header)
  color: #fff
  padding-top: var(--spacing-4)
  border-radius: 0 0 22px 22px

.erp-screen__head-inner
  padding: 0 var(--spacing-4) calc(var(--spacing-5) + 8px)

.erp-screen__head-row
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-4)

.erp-screen__brand
  display: flex

.erp-screen__brand-mark
  height: 22px
  width: auto
  display: block
  /* Лого не меняем — только рендерим белым для контраста на синей шапке */
  filter: brightness(0) invert(1)
  opacity: 0.95

.erp-screen__head-actions
  display: flex
  align-items: center
  gap: var(--spacing-2)

.erp-screen__shift-link
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 5px
  padding: 6px 12px
  border-radius: var(--radius-full)
  background-color: rgba(255, 255, 255, 0.18)
  color: #fff
  font-size: var(--font-size-xs)
  font-weight: 600
  white-space: nowrap
  text-decoration: none
  border: none

.erp-screen__title
  display: flex
  align-items: center
  gap: var(--spacing-2)
  font-size: 26px
  font-weight: 800
  letter-spacing: -0.4px
  line-height: 1.1
  margin-bottom: var(--spacing-1)
  color: #fff

.erp-screen__title-icon
  flex-shrink: 0
  color: #fff
  opacity: 0.92

.erp-screen__subtitle
  font-size: var(--font-size-base)
  color: rgba(255, 255, 255, 0.85)
  line-height: 1.4

.erp-screen__hero
  margin-top: var(--spacing-4)

.erp-screen__search
  margin-top: var(--spacing-4)

.erp-screen__body
  flex: 1
  min-height: 0
  overflow-y: auto
  -webkit-overflow-scrolling: touch
  display: flex
  flex-direction: column
  align-items: stretch
  gap: var(--spacing-3)
  /* Тело «наезжает» на градиент — даёт глубину как в макете */
  margin-top: -14px
  padding: 0 var(--spacing-4) var(--spacing-4)
  position: relative
  z-index: 1

  > *
    flex-shrink: 0

.erp-screen__footer
  flex-shrink: 0
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  padding: var(--spacing-3) var(--spacing-4) calc(var(--spacing-4) + env(safe-area-inset-bottom))
  border-top: 0.5px solid var(--color-border)
  background-color: var(--color-bg)
</style>
